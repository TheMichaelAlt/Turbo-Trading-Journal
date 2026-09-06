// Some development hosts run Electron as Node. The desktop process needs its normal runtime.
delete process.env.ELECTRON_RUN_AS_NODE
const { createServer } = await import('vite')
const server = await createServer()
await server.listen()
server.printUrls()
