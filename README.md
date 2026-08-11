# superneo.ai

Static site for `superneo.ai`.

## Local

```sh
npm ci
npm run dev
```

## Verify

```sh
npm test
```

## GitHub Pages

```sh
npm run build
```

The static output is written to `dist`. Push `main` to run the Pages workflow. In the repository settings, set Pages to use GitHub Actions and enter `superneo.ai` as the custom domain.

Optional analytics require both repository variables:

- `POSTHOG_PROJECT_KEY`
- `POSTHOG_IP_DISCARD_CONFIRMED=true`

Set the confirmation variable only after enabling **Discard IP data** in the PostHog project. Keep autocapture, heatmaps, session recording, exception capture, surveys, and person profiles disabled. Without the confirmation, the production bundle does not initialize analytics.
