Ship a working, user-verifiable feature for every open issue in auditmos/signmos, 
one issue per commit, verified by (a) issue-specific Vitest tests covering every AC 
including numeric/resource bounds, (b) `pnpm types && pnpm test && pnpm lint && pnpm build` 
all green, and (c) for any UI/API behavior, a manual agent-browser walkthrough of the 
golden path with snapshot evidence, while preserving existing behavior and never 
reverting unrelated user changes. 

Use the tdd skill for each issue: `gh issue view` -> extract every AC (including 
numeric bounds) -> check docs/plans/lessons first -> state assumptions -> stop and 
ask if any AC is ambiguous -> vertical TDD slices (one failing behavior test -> 
minimal code -> green, repeat). Co-locate Vitest tests at public module boundaries 
only; mock only external boundaries; every changed line must trace to a test or 
explicit AC. One focused commit per issue referencing the issue number; close via 
`gh issue close` only after all checks pass. Do not push until explicitly asked. 

Between iterations, pick the next open issue by dependency order and smallest safe 
vertical slice that still delivers an end-to-end working feature. If repo state is 
dirty, inspect and preserve unrelated changes before starting. Do not quote timing 
or resource numbers unless measured; for any script >5 min, require heartbeat output 
or flag its absence. 

If blocked on an issue, stop that issue and report a status table per AC 
(verified / failing / blocked / not tested) with command + browser evidence and the 
blocker. Continue only with another independent issue that can be safely handled. 
Completion of the overall goal requires every targeted issue closed with all 
verification surfaces green, OR a final audit listing every remaining issue's 
blocker and the input needed to unlock it.