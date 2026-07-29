import obsidianmd from "eslint-plugin-obsidianmd";

export default [
  ...obsidianmd.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "obsidianmd/ui/sentence-case": ["warn", { acronyms: ["HTML"] }],
    },
  },
];
