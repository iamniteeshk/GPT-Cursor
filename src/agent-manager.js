import { AgentRunner } from "./agent-runner.js";
import { config } from "./config.js";

/**
 * Up to MAX_AGENTS concurrent GPT↔Cursor runs on one shared Chrome/Edge.
 * Each run uses 2 tabs → 5 agents = 10 tabs.
 */
export class AgentManager {
  /**
   * @param {object} opts
   * @param {import('./browser-session.js').BrowserSession} opts.session
   * @param {number} [opts.maxAgents]
   * @param {(event: string, payload: object) => Promise<void>|void} [opts.onEvent]
   */
  constructor({ session, maxAgents = config.maxAgents, onEvent = null } = {}) {
    this.session = session;
    this.maxAgents = Math.max(1, Number(maxAgents) || 5);
    this.onEvent = typeof onEvent === "function" ? onEvent : async () => {};
    /** @type {Map<string, { runner: AgentRunner, promise: Promise<any>, startedAt: number, startedBy: string }>} */
    this.agents = new Map();
    this._seq = 0;
  }

  list() {
    return [...this.agents.entries()].map(([id, entry]) => ({
      ...entry.runner.snapshot(),
      startedBy: entry.startedBy,
      wallStartedAt: entry.startedAt,
    }));
  }

  get(id) {
    const entry = this.agents.get(String(id));
    if (!entry) return null;
    return {
      ...entry.runner.snapshot(),
      startedBy: entry.startedBy,
      wallStartedAt: entry.startedAt,
    };
  }

  activeCount() {
    return [...this.agents.values()].filter((e) => {
      const s = e.runner.status;
      return s === "running" || s === "starting" || s === "waiting_cursor" || s === "waiting_gpt" || s === "reconnecting" || s === "stopping";
    }).length;
  }

  async start({ gptUrl, cursorUrl, startedBy = "cli" } = {}) {
    this._pruneFinished();
    if (this.activeCount() >= this.maxAgents) {
      throw new Error(
        `Already running ${this.activeCount()}/${this.maxAgents} agents (10 tabs max). Stop one with /stop <id>.`
      );
    }

    this._seq += 1;
    const id = String(this._seq);
    const runner = new AgentRunner({
      id,
      gptUrl,
      cursorUrl,
      session: this.session,
      onEvent: async (line) => {
        await this.onEvent("log", { agentId: id, message: line });
        if (String(line).includes("Automation Done")) {
          await this.onEvent("agent_done", {
            agentId: id,
            gptUrl,
            cursorUrl,
            loops: runner.loop,
            startedBy,
          });
        }
      },
    });

    const promise = runner
      .start()
      .then(async (result) => {
        if (result?.completed) {
          // agent_done already emitted from log line; ensure once more if needed
        } else if (result?.stopped) {
          await this.onEvent("agent_stopped", {
            agentId: id,
            gptUrl,
            cursorUrl,
            loops: runner.loop,
            startedBy,
          });
        }
        return result;
      })
      .catch(async (err) => {
        await this.onEvent("agent_failed", {
          agentId: id,
          error: err?.message || String(err),
          gptUrl,
          cursorUrl,
          startedBy,
          loops: runner.loop,
        });
        throw err;
      })
      .finally(() => {
        setTimeout(() => this._pruneFinished(true), 30 * 60 * 1000).unref?.();
      });

    this.agents.set(id, {
      runner,
      promise,
      startedAt: Date.now(),
      startedBy,
      gptUrl,
      cursorUrl,
    });

    await this.onEvent("agent_started", {
      agentId: id,
      gptUrl,
      cursorUrl,
      startedBy,
      active: this.activeCount(),
      max: this.maxAgents,
    });

    return { id, runner, promise };
  }

  async stop(id) {
    const entry = this.agents.get(String(id));
    if (!entry) throw new Error(`Unknown agent id: ${id}`);
    entry.runner.requestStop();
    try {
      await entry.promise;
    } catch {
      // ignore
    }
    return entry.runner.snapshot();
  }

  async stopAll() {
    const ids = [...this.agents.keys()];
    for (const id of ids) {
      try {
        await this.stop(id);
      } catch {
        // ignore
      }
    }
  }

  formatStatus(id = null) {
    if (id != null && String(id).trim() !== "") {
      const one = this.get(String(id).trim());
      if (!one) return `No agent with id ${id}.\n\n${this.formatStatus()}`;
      return formatOne(one);
    }
    const all = this.list();
    if (!all.length) {
      return `No agents yet.\nMax ${this.maxAgents} concurrent (= ${this.maxAgents * 2} tabs).\nStart: /run`;
    }
    return [
      `Agents: ${this.activeCount()} active / ${all.length} tracked (max ${this.maxAgents})`,
      "",
      ...all.map(formatOne),
    ].join("\n");
  }

  _pruneFinished(force = false) {
    const now = Date.now();
    for (const [id, entry] of this.agents.entries()) {
      const st = entry.runner.status;
      if (["running", "starting", "waiting_cursor", "waiting_gpt", "reconnecting", "stopping"].includes(st)) {
        continue;
      }
      const finishedAt = entry.runner.finishedAt
        ? Date.parse(entry.runner.finishedAt)
        : entry.startedAt;
      const age = now - (finishedAt || now);
      if (force || age > 30 * 60 * 1000) {
        this.agents.delete(id);
      }
    }
  }
}

function formatOne(a) {
  const started = a.wallStartedAt || (a.startedAt ? Date.parse(a.startedAt) : null);
  const age = started ? `${Math.round((Date.now() - started) / 60000)}m ago` : "?";
  const err = a.lastError ? `\n  error: ${a.lastError}` : "";
  return (
    `#${a.id} [${a.status}] loop=${a.loop} prompt=#${a.promptNumber || "?"} · ${age}` +
    `\n  GPT: ${shortUrl(a.gptUrl)}` +
    `\n  Cursor: ${shortUrl(a.cursorUrl)}` +
    err
  );
}

function shortUrl(u) {
  if (!u) return "(none)";
  try {
    const url = new URL(u);
    const path = url.pathname.length > 48 ? `${url.pathname.slice(0, 45)}…` : url.pathname;
    return `${url.hostname}${path}`;
  } catch {
    return String(u).slice(0, 80);
  }
}
