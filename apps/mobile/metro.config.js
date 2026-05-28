const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo so workspace packages (e.g. @raket/contracts) are visible.
config.watchFolders = [workspaceRoot];

// Resolve modules: project-local first, then workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Pin react and react-native to the workspace root where both live at matching versions.
// react@19.1.0 and react-native-renderer@19.1.0 must be identical versions — React 19
// throws a hard error if they differ.
config.resolver.extraNodeModules = {
  react: path.resolve(workspaceRoot, "node_modules/react"),
  "react-native": path.resolve(workspaceRoot, "node_modules/react-native"),
  "react-dom": path.resolve(workspaceRoot, "node_modules/react-dom"),
};

// On web, several native-only packages must be stubbed out so the web bundle
// resolves. Each stub lives in src/lib/ and mirrors the real module's API.
const WEB_STUBS = {
  "@stripe/stripe-react-native": path.resolve(__dirname, "src/lib/stripe-web-stub.js"),
  "expo-secure-store": path.resolve(__dirname, "src/lib/secure-store-web-stub.js"),
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && WEB_STUBS[moduleName]) {
    return { type: "sourceFile", filePath: WEB_STUBS[moduleName] };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
