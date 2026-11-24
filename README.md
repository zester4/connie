# Connie

Tool-calling terminal agent powered by OpenRouter. No SDK dependency — native `fetch`, streaming replies, Markdown rendering, session persistence, a boxed banner, colored tool-call output, a spinner, and confirmation prompts for risky actions.

## Project layout

```
connie/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts          # entry point + REPL
    ├── agent.ts          # streaming tool-calling loop
    ├── config.ts         # env-driven config
    ├── openrouter.ts     # OpenRouter client (SSE streaming, retries)
    ├── prompt.ts         # readline + confirm()
    ├── ui.ts             # terminal rendering + Markdown
    ├── session.ts        # JSONL session persistence
    ├── types.ts
    └── tools/
        ├── registry.ts   # tool registration
        ├── builtin.ts    # starter tools + create_tool
        └── loader.ts     # loads/validates custom tools from ~/.connie/tools
```

## Quick start

```bash
npm install
export OPENROUTER_API_KEY=sk-or-v1-...
npm start                  # dev, runs via tsx
# or
npm run build && npm link  # installs the `connie` command globally
connie
```

Set `CONNIE_MODEL` to any model slug from [openrouter.ai/models](https://openrouter.ai/models) that supports tools. Filter with `?supported_parameters=tools`. Default: `anthropic/claude-sonnet-4`.

## What's new in v0.2

| Feature | Details |
|---------|---------|
| **Streaming** | Replies appear token-by-token via OpenRouter SSE |
| **Markdown** | Final replies rendered with `marked` + `marked-terminal` |
| **Sessions** | Append-only JSONL under `~/.connie/sessions/` |
| **Resume** | `/sessions` and `/resume <id>` to continue past chats |

Ink was considered for a full TUI rewrite but skipped — the current chalk + spinner stack stays lighter and faster for a REPL-style agent.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENROUTER_API_KEY` | *required* | Your OpenRouter API key |
| `CONNIE_MODEL` | `anthropic/claude-sonnet-4` | Model slug |
| `CONNIE_MAX_STEPS` | `15` | Max tool-call loops per turn |
| `CONNIE_HOME` | `~/.connie` | Home for tools + sessions |

## Builtin tools

| Tool | Description |
|------|-------------|
| `read_file` | Read a UTF-8 text file |
| `write_file` | Create or overwrite a file (**requires approval**) |
| `list_dir` | List directory entries (dirs end with `/`) |
| `run_shell` | Run a shell command, 30s timeout (**requires approval**) |
| `create_tool` | Create a persistent custom tool (**requires approval**) |

## How self-made tools work

When Connie needs a capability it doesn't have, it calls `create_tool` with a name, description, JSON Schema, and function body. You see the full source and approve with `y`. The file is written to `~/.connie/tools/<name>.mjs`, loaded immediately, and reloaded on every future start. Failed modules are deleted.

Custom tools run with your full permissions — review before approving. Confirmation is the only safeguard; there is no sandbox.

### Custom tool format

```js
// ~/.connie/tools/my_tool.mjs
export const description = "Does something useful";
export const parameters = {
  type: "object",
  properties: {
    input: { type: "string" },
  },
  required: ["input"],
};
export default async function run(args) {
  return `Got: ${args.input}`;
}
```

## Sessions

Every conversation is saved as an append-only JSONL file:

```
~/.connie/sessions/2026-11-24T07-22-00-chat.jsonl
```

Each line is a `SessionEvent` (role, content, tool_calls, timestamp). Use `/sessions` to list recent ones and `/resume <id-or-prefix>` to continue.

## REPL commands

```
/help       show this help
/tools      list available tools
/sessions   list recent sessions
/resume     resume a session (id or prefix)
/reset      clear conversation + start new session
/exit       quit
```

## License

MIT
