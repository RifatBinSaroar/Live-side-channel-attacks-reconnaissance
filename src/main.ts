function createWorker(
    url: string,
    ...args: any[]
) {
    const worker = new Worker(url);
    worker.postMessage(args);

    return new Promise<Worker>((resolve, reject) => {
        worker.onmessage = function(){
            resolve(worker);
        }
        worker.onerror = function(e){
            reject(e);
        }
    });
}

async function fetchModule(path: string){
    const response = await fetch(path);
    const contents = await response.arrayBuffer();
    return new WebAssembly.Module(contents);
}

async function main(){
    const memory = new WebAssembly.Memory({initial: 2048, maximum: 2048, shared: true} as any);

    // Load web assembly modules
    const accessModule = await fetchModule('./build/wasm/access.wasm');
    const clockModule  = await fetchModule('./build/wasm/clock.wasm');

    // Start up clock thread
    const clockWorker = await createWorker('./build/js/clock_thread.js', memory, clockModule);
    const mainWorker = await createWorker('./build/js/main_thread.js', memory, accessModule);

    function shutdown(e: any){
        console.log("Shut down", e);
        clockWorker.terminate();
        mainWorker.terminate();
    }
    clockWorker.onerror = shutdown;
    clockWorker.onmessage = shutdown;
    mainWorker.onerror = shutdown;
    mainWorker.onmessage = (message: MessageEvent) => {
        if(message.data === "END"){
            clockWorker.terminate();
            mainWorker.terminate();
        } else {
            console.log(message.data);
        }
    }
}

main();