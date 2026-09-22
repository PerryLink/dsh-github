declare module '@deepseek-ai/dsh-llm/message' {
    interface MessageSourceMap {
        /** A notice dsh-github queued for the model on a human command's behalf. */
        'dsh-github': {
            kind: 'dsh-github';
        } & ContextFormed;
    }
}
export {};
//# sourceMappingURL=message-source.d.ts.map