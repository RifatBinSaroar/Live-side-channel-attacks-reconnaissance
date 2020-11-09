const natives_enabled = (function(){
    try{
        eval('%GetHeapUsage();');
        return true;
    }
    catch{}
    return false;
})();

function natives_get(name: string, count: number): Function {
    if(natives_enabled){
        const args = new Array(count).fill(0).map((_, x) => 'x' + x).join(',');
        const f = eval(`(function(${args}){ return %${name}(${args});});`);
        return f;
    } else {
        return () => {};
    }
}

const natives = {
    enabled: natives_enabled,
    optimizeFunctionOnNextCall: natives_get('OptimizeFunctionOnNextCall', 1) as (f: Function) => void,
    debugPrint: natives_get('DebugPrint', 1) as (text: string) => void,
};