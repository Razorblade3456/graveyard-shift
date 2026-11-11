const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// expo-sqlite on web loads a WebAssembly build of SQLite.
config.resolver.assetExts.push('wasm');

// react-native-maps has no web implementation; the map is only rendered on iOS,
// so resolve it to a harmless stub for web bundles.
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && (moduleName === 'react-native-maps' || moduleName.startsWith('react-native-maps/'))) {
    return { type: 'sourceFile', filePath: path.resolve(__dirname, 'web-stubs/react-native-maps.js') };
  }
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
