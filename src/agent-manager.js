import { AgentRunner } from "./agent-runner.js";
import { config } from "./config.js";

const ACTIVE = new Set([
  "running",
  "starting",
  "waiting_cursor",
  "waiting_gpt",
  "reconnecting",
  "stopping",
]);

function isActiveStatus(status) {
  return ACTIVE.has(status);
}

/**
 * Fixed agent slots 1..MAX_AGENTS (default 5).
 * /run picks the lowest free slot: 1, then 2, … then 5.
 * Each slot uses 2 tabs → 5 agents = 10 tabs.
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
  }

  /** First free slot id "1".."max", or null if all busy. */
  nextFreeSlot() {
    for (let n = 1; n <= this.maxAgents; n += 1) {
      const id = String(n);
      const entry = this.agents.get(id);
      if (!entry || !isActiveStatus(entry.runner.status)) {
        return id;
      }
    }
    return null;
  }

  listSlots() {
    const out = [];
    for (let n = 1; n <= this.maxAgents; n += 1) {
      const id = String(n);
      const entry = this.agents.get(id);
      if (!entry) {
        out.push({
          id,
          status: "idle",
          loop: 0,
          promptNumber: 0,
          gptUrl: "",
          cursorUrl: "",
          lastError: "",
          startedAt: null,
          finishedAt: null,
          stopRequested: false,
          startedBy: "",
          wallStartedAt: null,
        });
        continue;
      }
      out.push({
        ...entry.runner.snapshot(),
        startedBy: entry.startedBy,
        wallStartedAt: entry.startedAt,
      });
    }
    return out;
  }

  list() {
    return this.listSlots().filter((a) => a.status !== "idle");
  }

  get(id) {
    const key = String(id).trim();
    if (!key) return null;
    const n = Number(key);
    if (!Number.isFinite(n) || n < 1 || n > this.maxAgents) return null;
    const entry = this.agents.get(String(n));
    if (!entry) {
      return {
        id: String(n),
        status: "idle",
        loop: 0,
        promptNumber: 0,
        gptUrl: "",
        cursorUrl: "",
        lastError: "",
        startedAt: null,
        finishedAt: null,
        stopRequested: false,
        startedBy: "",
        wallStartedAt: null,
      };
    }
    return {
      ...entry.runner.snapshot(),
      startedBy: entry.startedBy,
      wallStartedAt: entry.startedAt,
    };
  }

  activeCount() {
    return this.listSlots().filter((a) => isActiveStatus(a.status)).length;
  }

  async start({ gptUrl, cursorUrl, startedBy = "cli" } = {}) {
    const id = this.nextFreeSlot();
    if (!id) {
      throw new Error(
        `All ${this.maxAgents} agents busy (10 tabs). Stop one with /stop N or /stop for all.`
      );
    }

    // Clear finished occupant of this slot before reuse.
    this.agents.delete(id);

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
        if (result?.stopped) {
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
    const key = String(id).trim();
    const entry = this.agents.get(key);
    if (!entry) throw new Error(`Agent #${key} is idle / unknown. Use /status`);
    if (!isActiveStatus(entry.runner.status) && entry.runner.status !== "stopping") {
      throw new Error(`Agent #${key} is not running (status: ${entry.runner.status}).`);
    }
    entry.runner.requestStop();
    try {
      await entry.promise;
    } catch {
      // ignore
    }
    return entry.runner.snapshot();
  }

  async stopAll() {
    const ids = this.listSlots()
      .filter((a) => isActiveStatus(a.status))
      .map((a) => a.id);
    for (const id of ids) {
      try {
        await this.stop(id);
      } catch {
        // ignore
      }
    }
    return ids;
  }

  formatStatus(id = null) {
    if (id != null && String(id).trim() !== "") {
      const key = String(id).trim();
      const one = this.get(key);
      if (!one) {
        return `Invalid agent #${key}. Use 1–${this.maxAgents}.\n\n${this.formatStatus()}`;
      }
      return formatOne(one);
    }

    const slots = this.listSlots();
    return [
      `Agents ${this.activeCount()}/${this.maxAgents} busy · ${this.maxAgents * 2} tabs max`,
      "",
      ...slots.map(formatOne),
      "",
      "Commands: /run  /status  /status N  /stop  /stop N",
    ].join("\n");
  }
}

function formatOne(a) {
  if (a.status === "idle") {
    return `#${a.id} [idle]`;
  }
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
