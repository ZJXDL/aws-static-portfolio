# Minefield product design

## Product scope

Minefield is a focused, single-mode Minesweeper game. The player can start immediately as a guest and choose one of three standard boards:

| Board | Grid | Mines |
| --- | ---: | ---: |
| Easy | 9 × 9 | 10 |
| Medium | 16 × 16 | 40 |
| Expert | 16 × 30 | 99 |

The first opened tile and the surrounding eight tiles are protected. A clock starts on the first reveal. Players can flag with a mouse, keyboard, or touch-friendly flag mode. Personal bests are stored in local browser storage on that device.

The deployed app does not yet have accounts or a shared leaderboard. This is intentional: browser-only times are easy to alter, so a global ranking should not accept a score supplied only by client JavaScript.

## Interface decisions

The game is the main and only product surface. The board is centered in a dark navy palette, with orange reserved for the active state, key controls, and game feedback. Easy, Medium, and Expert stay visible as direct choices instead of being hidden in a menu. The mine count, elapsed time, current state, and personal best remain beside the board.

The interaction model uses standard Minesweeper rules:

- Left-click or tap a covered tile to reveal it.
- Right-click to flag on a computer.
- Turn on Flag mode to flag by tapping or clicking.
- Use the arrow keys to move through the grid, Enter or Space to reveal, and F to toggle Flag mode.
- Click a revealed number to clear its neighbors when the adjacent flag count matches the clue.

The screen follows a few established usability principles:

- **Show the state:** the mine count, timer, flag mode, and result are visible and update with play.
- **Make options recognizable:** board sizes and the help action stay visible, so players do not need to remember a hidden shortcut.
- **Support different input methods:** the board works with pointer, touch, and keyboard, with a visible focus indicator.
- **Use sufficiently large touch targets:** tiles remain at least 24 CSS pixels square; on phones they are 30 CSS pixels. The board can scroll horizontally on narrow screens rather than shrinking the targets.

These choices follow [Nielsen Norman Group's usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) and the relevant [WCAG 2.2 target-size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) and [focus-appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) guidance.

For genre conventions, I also reviewed a current mobile Minesweeper implementation that documents standard difficulty sizes, a protected 3 × 3 opening, tap-to-chord, and a flag-mode option. These keep familiar desktop rules usable on touch screens ([Google Play listing](https://play.google.com/store/apps/details?id=com.minesweeper.fishtail)).

## Account and global leaderboard plan

A shared leaderboard should be a real service, not a decorative sample list. The game should remain playable without an account; signing in should be optional and only needed to publish or associate a score. Public rankings should show a chosen display name, never an email address.

A suitable AWS extension is:

1. **Amazon Cognito User Pool** for optional accounts. A browser client should use OAuth authorization code with PKCE and have no embedded client secret.
2. **API Gateway HTTP API** with a JWT authorizer for account-only score operations. A public read route can return the current top scores.
3. **AWS Lambda** to own game sessions, validate a completed run, and accept a score only after server-side verification. The API must identify the player from the verified token rather than trusting a user ID in the request.
4. **Amazon DynamoDB** for score records and leaderboard queries, with board size and elapsed time as the ranking dimensions. A single AWS Region can serve one worldwide leaderboard; multi-Region replication is a separate availability decision.

To make ranked times meaningful, the server must create or validate each run and calculate its duration from trusted server timestamps. A score endpoint that accepts a browser-provided time would be easy to cheat. Server-side verification raises the cost of cheating, but no browser game should promise perfect cheat prevention.

This backend has not been provisioned. It adds AWS services, operational responsibility, and possible usage charges. The existing GitHub deployment role only publishes static files and cannot create or modify these resources. Review the infrastructure plan and expected charges before adding the backend.

## References

- [Amazon Cognito app clients](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-client-apps.html)
- [Amazon Cognito OAuth grants and PKCE](https://docs.aws.amazon.com/cognito/latest/developerguide/federation-endpoints-oauth-grants.html)
- [API Gateway HTTP API JWT authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)
- [DynamoDB global secondary indexes](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html)
- [Nielsen Norman Group: 10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [WCAG 2.2: Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [WCAG 2.2: Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)
