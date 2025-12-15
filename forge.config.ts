import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { PublisherGithub } from '@electron-forge/publisher-github';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: './assets/icon',
    name: 'DeezerYouTubeDownloader',
    executableName: 'deezer-youtube-downloader',
    extraResource: ['./bin'],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'DeezerYouTubeDownloader',
      setupIcon: './assets/icon.ico',
    }),
    new MakerZIP({}, ['darwin', 'linux', 'win32']),
    new MakerDMG({
      format: 'ULFO',
    }),
    new MakerDeb({
      options: {
        maintainer: 'Paulem79',
        homepage: 'https://github.com/Paulem79/deezer-yt-download',
      },
    }),
    new MakerRpm({
      options: {
        homepage: 'https://github.com/Paulem79/deezer-yt-download',
      },
    }),
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: 'Paulem79',
        name: 'deezer-yt-download',
      },
      prerelease: true,
    }),
  ],
  plugins: [
    new WebpackPlugin({
      mainConfig: {
        entry: './src/main/index.ts',
        module: {
          rules: [
            {
              test: /\.ts$/,
              exclude: /node_modules/,
              use: {
                loader: 'ts-loader',
                options: {
                  transpileOnly: true,
                },
              },
            },
            {
              test: /\.node$/,
              use: 'node-loader',
            },
          ],
        },
        resolve: {
          extensions: ['.js', '.ts', '.json', '.node'],
        },
      },
      renderer: {
        config: {
          module: {
            rules: [
              {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: {
                  loader: 'ts-loader',
                  options: {
                    transpileOnly: true,
                  },
                },
              },
              {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
              },
            ],
          },
          resolve: {
            extensions: ['.js', '.ts', '.css'],
          },
        },
        entryPoints: [
          {
            html: './src/renderer/index.html',
            js: './src/renderer/renderer.ts',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
              config: {
                module: {
                  rules: [
                    {
                      test: /\.ts$/,
                      exclude: /node_modules/,
                      use: {
                        loader: 'ts-loader',
                        options: {
                          transpileOnly: true,
                        },
                      },
                    },
                  ],
                },
                resolve: {
                  extensions: ['.js', '.ts'],
                },
              },
            },
          },
        ],
      },
    }),
  ],
};

export default config;