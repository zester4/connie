# Connie

Tool-calling terminal agent powered by OpenRouter. Extensible tools, clean REPL, and a simple architecture.

## Structure

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
cp .env.example .env   # add your OPENROUTER_API_KEY
npm run dev
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENROUTER_API_KEY` | *required* | Your OpenRouter API key |
| `OPENROUTER_MODEL` | `openai/gpt-4o-mini` | Model ID |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | API base |
| `CONNIE_MAX_TOKENS` | `4096` | Max completion tokens |
| `CONNIE_TEMPERATURE` | `0.7` | Sampling temperature |
| `CONNIE_MAX_TOOL_ROUNDS` | `8` | Max tool-call loops per turn |
| `CONNIE_SYSTEM_PROMPT` | (built-in) | Override system prompt |

## Builtin tools

- `read_file` — read a file
- `write_file` — write a file (creates dirs)
- `list_dir` — list directory entries
- `run_command` — run a shell command
- `create_tool` — register a simple runtime tool

## Custom tools

Drop a `.js` / `.mjs` module in `~/.connie/tools/` that exports a tool object:

```js
export default {
  name: "my_tool",
  description: "Does something useful",
  parameters: {
    type: "object",
    properties: {
      input: { type: "string" },
    },
    required: ["input"],
  },
  async execute({ input }) {
    return `Got: ${input}`;
  },
};
```

## License

MIT
