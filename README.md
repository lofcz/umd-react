# UMD builds for React 19+

UMD builds were [removed](https://react.dev/blog/2024/04/25/react-19-upgrade-guide#umd-builds-removed) from React 19. This repository serves as a way to continue using React via UMD. Built files are available [here](https://github.com/lofcz/react19umd/releases) or via npm as package `umd-react`. 

```
npm i umd-react
```

The files are built so that `ReactDOM` & `ReactDOMClient` are squished back into `ReactDOM` for backward compatibility.
