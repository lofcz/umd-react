# UMD builds for React 19+

UMD builds were [removed](https://react.dev/blog/2024/04/25/react-19-upgrade-guide#umd-builds-removed) from React 19. This repository serves as a way to continue using React via UMD. Built files are available [here](https://github.com/lofcz/react19umd/releases) or via npm as package `umd-react`. 

Get the files:

```
npm i umd-react
```

Or via CDN:
```js
<script src="https://unpkg.com/umd-react/dist/react.production.min.js" />
<script src="https://unpkg.com/umd-react/dist/react-dom.production.min.js" />
```


The files are built so that `ReactDOM` & `ReactDOMClient` are squished back into `ReactDOM` for backward compatibility.

⭐ Files are built and published on NPM automatically (GitHub Workflow checks upstream daily) so this repository should always be synced with upstream until some major changes occur.
