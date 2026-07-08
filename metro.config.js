const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  unstable_experiments: {
    ...config.server?.unstable_experiments,
    enableStandaloneFuseboxShell: false,
  },
};

module.exports = config;
