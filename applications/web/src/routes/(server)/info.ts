import { createFileRoute } from '@tanstack/react-router';

const getInfo = () => {
  const version = process.env.APP_VERSION;
  const commit = process.env.GIT_COMMIT;
  const buildTime = process.env.BUILD_TIME;
  return {
    version: version !== undefined && version !== '' ? version : 'dev',
    commit: commit !== undefined && commit !== '' ? commit : 'unknown',
    build_time: buildTime !== undefined && buildTime !== '' ? buildTime : null,
  };
};

export const Route = createFileRoute('/(server)/info')({
  ssr: true,
  server: {
    handlers: {
      GET: () => Response.json(getInfo()),
    },
  },
});
