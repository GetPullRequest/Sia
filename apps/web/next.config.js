//@ts-check

const { composePlugins, withNx } = require('@nx/next');

const webpack = require('webpack');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
  webpack: (config, { isServer }) => {
    // Handle Node.js modules in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'form-data': false,
        fs: false,
        tls: false,
        net: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
      // Ignore gRPC code in browser (only needed for Node.js)
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^@grpc\/grpc-js$/,
        }),
        new webpack.IgnorePlugin({
          resourceRegExp: /^@bufbuild\/protobuf$/,
        })
      );
    }
    return config;
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
