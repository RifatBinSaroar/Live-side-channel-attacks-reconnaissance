importScripts("./linked_list.js");
importScripts("./eviction_sets.js");
importScripts("./natives_v8.js");

const sample_count = 6;         // Number of samples to make when determining if eviction occurs
const threshold = 65;           // Number of ticks on the counter for a cache hit/miss
const discard_zero = false;     // Discard samples where the timer reports zero change after reading

function main_thread(memory: WebAssembly.Memory, module: WebAssembly.Module){
    
//get time
    var t0 = new Date().getTime();

const accessInstance = new WebAssembly.Instance(module, {env: {mem: memory}});


    const {access_set, time_element, wasm_miss, bprobe, probe} = (accessInstance.exports as any as WasmModuleApi);

    // Create a view into memory for us to use
    const view = new DataView(memory.buffer);
    view.setUint32(0, 0, true); // Ensure allocation

    // A function that answers the following question.
    //  Does our eviction set 'ptr' evict 'victim'?
    //  'ptr' is the first element in a linked list of elements
    function evicts(victim: number, ptr: number){
        const samples = [];

        for(let sample = 0; sample < sample_count; sample++){
            let result = 0;
            do{
                result = Number(wasm_miss(victim, ptr));
            }
            while(result === 0 && discard_zero);
            samples.push(result);
        }

        samples.sort((a, b) => a - b);

        const time = (samples.length % 2 === 1) ?
            samples[Math.floor(samples.length / 2)] :
            (samples[samples.length / 2] + samples[samples.length / 2 + 1]) / 2;

        return time >= threshold;
    }

    // Try to optimize 'evicts'
    //  TODO: Check this is actually doing something
    for(let i = 0; i < 1000; i++){
        evicts(0, 0);
    }

    if(!natives.enabled){
        console.warn('Run with --allow-natives-syntax to get debug output');
    }

    console.log('lol');
    const sets = EvictionSet.generateAll(view, evicts, {
        threshold: threshold,
        probe: (set, threshold) => probe(set.first, threshold),
        bprobe: (set, threshold) => bprobe(set.last, threshold),
    });

    EvictionSets.toValidationString(sets, x => {
        console.log(x);
        natives.debugPrint(x);
    });
    console.log(sets.sets.length + " built");

    //get last time
    var t1 = new Date().getTime();
    console.log("Call to doWork took " + (t1 - t0) + " milliseconds.")
}

onmessage = function(e: MessageEvent){
    postMessage({});
    try {
        (main_thread as any)(...e.data);
    }
    finally {
        postMessage("END");
    }
}

interface WasmModuleApi {
    wasm_hit: (victim: number) => number;
    wasm_miss: (victim: number, ptr: number) => number;

    access_set: (ptr: number) => number;
    time_element: (element: number) => number;
    probe: (ptr: number, threshold: number) => number;
    bprobe: (ptr: number, threshold: number) => number;
}
