import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { minify } from 'terser';
import path from 'path';
import { fileURLToPath } from 'url';
import { rmSync } from 'fs';
import webpack from 'webpack';
import semver from 'semver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync('./node_modules/react/package.json'));
const version = pkg.version;
const isReact19OrHigher = semver.gte(version, '19.0.0');

const terserConfig = {
    compress: {
        dead_code: true,
        drop_console: true,
        drop_debugger: true,
        passes: 1,
        unused: true
    },
    mangle: false,
    format: {
        comments: false,
        ascii_only: true
    }
};

async function runWebpack(config) {
    return new Promise((resolve, reject) => {
        webpack(config, (err, stats) => {
            if (err) {
                reject(err);
                return;
            }
            if (stats.hasErrors()) {
                reject(new Error(stats.toString()));
                return;
            }
            resolve(stats);
        });
    });
}

async function executeNodeScript(scriptContent) {
    const tempFile = path.join(__dirname, 'temp', 'temp-script.mjs');
    writeFileSync(tempFile, scriptContent);

    const { spawn } = await import('child_process');

    return new Promise((resolve, reject) => {
        const process = spawn('node', [tempFile], {
            stdio: ['inherit', 'pipe', 'inherit']
        });

        let output = '';
        process.stdout.on('data', (data) => {
            output += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve(output.trim());
            } else {
                reject(new Error(`Script execution failed with code ${code}`));
            }
        });
    });
}


async function generateEntryFile(tempDir) {
    const scriptContent = `
        import * as ReactDOM from 'react-dom';
        import * as ReactDOMClient from 'react-dom/client';
        
        // split methods from both modules
        const clientOnlyMethods = ['createRoot', 'hydrateRoot'];
        const domOnlyMethods = Object.keys(ReactDOM)
            .filter(key => 
                key !== 'default' && 
                !clientOnlyMethods.includes(key)
            );
            
        const allExports = [...clientOnlyMethods, ...domOnlyMethods];
        process.stdout.write(JSON.stringify({ clientOnlyMethods, domOnlyMethods }));
    `;

    const { clientOnlyMethods, domOnlyMethods } = JSON.parse(
        await executeNodeScript(scriptContent)
    );

    const entryContent = `
        import * as ReactDOM from 'react-dom';
        import * as ReactDOMClient from 'react-dom/client';

        // export clint methods
        ${clientOnlyMethods.map(method =>
        `export const ${method} = ReactDOMClient.${method};`
    ).join('\n')}

        // export dom methods
        ${domOnlyMethods.map(method =>
        `export const ${method} = ReactDOM.${method};`
    ).join('\n')}
    `;

    const entryFile = path.join(tempDir, 'react-dom-entry.js');
    writeFileSync(entryFile, entryContent);
    return entryFile;
}

const reactPlugin = {
    name: 'react-copy',
    async buildStart() {
        try {
            const tempDir = path.join(__dirname, 'temp');
            const tempDistDir = path.join(__dirname, 'temp-dist');

            rmSync(tempDir, { recursive: true, force: true });
            rmSync(tempDistDir, { recursive: true, force: true });
            mkdirSync(tempDir, { recursive: true });
            mkdirSync(tempDistDir, { recursive: true });

            const commonConfig = {
                mode: 'production',
                optimization: {
                    minimize: true,
                    usedExports: true
                },
                resolve: {
                    extensions: ['.js', '.jsx']
                },
                module: {
                    rules: [
                        {
                            test: /\.jsx?$/,
                            exclude: /node_modules/,
                            use: {
                                loader: 'babel-loader',
                                options: {
                                    presets: ['@babel/preset-react']
                                }
                            }
                        }
                    ]
                }
            };

            // 1. build files
            await runWebpack({
                ...commonConfig,
                entry: 'react',
                output: {
                    path: tempDistDir,
                    filename: 'react.production.min.js',
                    library: 'React',
                    libraryTarget: 'umd',
                    globalObject: 'this',
                    iife: true,
                    environment: {
                        arrowFunction: true,
                        const: true
                    }
                },
                plugins: [
                    new webpack.DefinePlugin({
                        'process.env.NODE_ENV': JSON.stringify('production')
                    })
                ]
            });

            if (isReact19OrHigher) { // react 19 added "ReactDomClient" which we need to merge back into "ReactDom"
                const entryFile = await generateEntryFile(tempDir);
                await runWebpack({
                    ...commonConfig,
                    entry: entryFile,
                    externals: {
                        'react': 'React'
                    },
                    output: {
                        path: tempDistDir,
                        filename: 'react-dom.production.min.js',
                        library: {
                            name: 'ReactDOM',
                            type: 'umd',
                            export: undefined
                        },
                        globalObject: 'this',
                        iife: true
                    },
                    plugins: [
                        new webpack.DefinePlugin({
                            'process.env.NODE_ENV': JSON.stringify('production')
                        })
                    ]
                });
            } else {
                await runWebpack({
                    ...commonConfig,
                    entry: 'react-dom',
                    externals: {
                        'react': 'React'
                    },
                    output: {
                        path: tempDistDir,
                        filename: 'react-dom.production.min.js',
                        library: 'ReactDOM',
                        libraryTarget: 'umd',
                        globalObject: 'this',
                        iife: true
                    },
                    plugins: [
                        new webpack.DefinePlugin({
                            'process.env.NODE_ENV': JSON.stringify('production')
                        })
                    ]
                });
            }

            // 2. minify
            const reactContent = readFileSync(path.join(tempDistDir, 'react.production.min.js'), 'utf8');
            const reactDomContent = readFileSync(path.join(tempDistDir, 'react-dom.production.min.js'), 'utf8');

            const minifiedReact = await minify(reactContent, terserConfig);
            const minifiedReactDom = await minify(reactDomContent, terserConfig);

            // 3. copy built umd files into dist
            this.emitFile({
                type: 'asset',
                fileName: 'react.production.min.js',
                source: `/*! react.production.min.js v${version} */\n${minifiedReact.code}`
            });

            this.emitFile({
                type: 'asset',
                fileName: 'react-dom.production.min.js',
                source: `/*! react-dom.production.min.js v${version} */\n${minifiedReactDom.code}`
            });

            rmSync(tempDir, { recursive: true, force: true });
            rmSync(tempDistDir, { recursive: true, force: true });

        } catch (error) {
            console.error('Error during build:', error);
            throw error;
        }
    }
};

export default {
    input: 'virtual',
    output: {
        dir: 'dist'
    },
    plugins: [{
        name: 'virtual',
        resolveId(id) {
            if (id === 'virtual') return id;
        },
        load(id) {
            if (id === 'virtual') return 'export default {}';
        }
    }, reactPlugin]
};
