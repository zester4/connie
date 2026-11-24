# Connie

Tool-calling terminal agent powered by OpenRouter. No SDK dependency — native `fetch`, a boxed banner, colored tool-call output, a spinner, and confirmation prompts for risky actions.

## Project layout

```
connie/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts          # entry point + REPL
    ├── agent.ts          # tool-calling loop
    ├── config.ts         # env-driven config
    ├── openrouter.ts     # OpenRouter client (retries, headers)
    ├── prompt.ts         # readline + confirm()
    ├── ui.ts             # all terminal rendering
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

Set `CONNIE_MODEL` to any model slug from [openrouter.ai/models](https://openrouter.ai/models) that supports tools. You can filter for them with `?supported_parameters=tools`. The default is `anthropic/claude-sonnet-4` — confirm that slug is still listed before relying on it.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENROUTER_API_KEY` | *required* | Your OpenRouter API key |
| `CONNIE_MODEL` | `anthropic/claude-sonnet-4` | Model slug |
| `CONNIE_MAX_STEPS` | `15` | Max tool-call loops per turn |
| `CONNIE_HOME` | `~/.connie` | Home directory for tools & future state |

## Builtin tools

| Tool | Description |
|------|-------------|
| `read_file` | Read a UTF-8 text file |
| `write_file` | Create or overwrite a file (**requires approval**) |
| `list_dir` | List directory entries (dirs end with `/`) |
| `run_shell` | Run a shell command, 30s timeout (**requires approval**) |
| `create_tool` | Create a persistent custom tool (**requires approval**) |

## How self-made tools work

When Connie decides it needs a capability it doesn't have, it calls `create_tool` with a name, description, JSON Schema, and function body. You see the full source and approve it with `y`. The file is written to `~/.connie/tools/<name>.mjs`, loaded immediately, and reloaded on every future start. If the module fails to load, it's deleted rather than left behind.

Custom tools run with your full permissions, so review the code before approving. The confirmation step is the only safeguard — it is not a sandbox.

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

## REPL commands

```
/help     show help
/tools    list available tools
/reset    clear the conversation
/exit     quit
```

## License

MIT
