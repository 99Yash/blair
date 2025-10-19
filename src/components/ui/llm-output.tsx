'use client';

import type { CodeToHtmlOptions } from '@llm-ui/code';
import {
  allLangs,
  allLangsAlias,
  codeBlockLookBack,
  findCompleteCodeBlock,
  findPartialCodeBlock,
  loadHighlighter,
  useCodeBlockToHtml,
} from '@llm-ui/code';
import { markdownLookBack } from '@llm-ui/markdown';
import { type LLMOutputComponent, useLLMOutput } from '@llm-ui/react';
import { bundledLanguagesInfo } from 'shiki/langs';
import githubDark from 'shiki/themes/github-dark.mjs';
import githubLight from 'shiki/themes/github-light.mjs';

import parseHtml from 'html-react-parser';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Dynamically import createHighlighter to avoid issues
const createHighlighterPromise = import('shiki').then((mod) =>
  mod.createHighlighter({
    langs: allLangs(bundledLanguagesInfo),
    langAlias: allLangsAlias(bundledLanguagesInfo),
    themes: [githubDark, githubLight],
  })
);

// Load the Shiki highlighter once
const highlighter = loadHighlighter(createHighlighterPromise);

const codeToHtmlOptions: CodeToHtmlOptions = {
  theme: 'github-dark',
};

// Markdown component for rendering non-code content
const MarkdownComponent: LLMOutputComponent = ({ blockMatch }) => {
  const markdown = blockMatch.output;
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
};

// Code block component with syntax highlighting
const CodeBlock: LLMOutputComponent = ({ blockMatch }) => {
  const { html, code } = useCodeBlockToHtml({
    markdownCodeBlock: blockMatch.output,
    highlighter,
    codeToHtmlOptions,
  });

  if (!html) {
    // Fallback to <pre> if Shiki is not loaded yet
    return (
      <pre className="shiki bg-zinc-900 rounded-lg p-4 overflow-x-auto">
        <code className="text-sm text-zinc-100">{code}</code>
      </pre>
    );
  }

  return (
    <div className="[&>pre]:rounded-lg [&>pre]:p-4">{parseHtml(html)}</div>
  );
};

interface LLMOutputProps {
  output: string;
  isStreamFinished: boolean;
  className?: string;
}

/**
 * Component that renders LLM output with proper markdown and code block handling
 * Uses llm-ui for streaming-aware parsing and rendering
 */
export function LLMOutput({
  output,
  isStreamFinished,
  className,
}: LLMOutputProps) {
  const { blockMatches } = useLLMOutput({
    llmOutput: output,
    fallbackBlock: {
      component: MarkdownComponent,
      lookBack: markdownLookBack(),
    },
    blocks: [
      {
        component: CodeBlock,
        findCompleteMatch: findCompleteCodeBlock(),
        findPartialMatch: findPartialCodeBlock(),
        lookBack: codeBlockLookBack(),
      },
    ],
    isStreamFinished,
  });

  return (
    <div className={className}>
      {blockMatches.map((blockMatch, index) => {
        const Component = blockMatch.block.component;
        return <Component key={index} blockMatch={blockMatch} />;
      })}
    </div>
  );
}
