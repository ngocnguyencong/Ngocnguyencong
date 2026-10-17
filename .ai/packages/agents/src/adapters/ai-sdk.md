# ai-sdk.ts

AI SDK agent runner. Uses the shared tool execution path with caller-injected workspace context, scope validation and call recording. Relative runtime imports use extensionless paths so source exports compile under the Web bundler. The adapter remains lazily loaded by createAgentRunner.
