async function clock_thread(memory: WebAssembly.Memory, module: WebAssembly.Module){
    const instance = new WebAssembly.Instance(module, { env: { mem: memory } });
    (instance.exports as any).main();
}

onmessage = function(e: MessageEvent){
    this.postMessage({});
    (clock_thread as any)(...e.data);
}