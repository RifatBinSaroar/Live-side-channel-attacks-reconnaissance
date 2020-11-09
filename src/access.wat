(module
    (import "env" "mem" (memory 2048 2048 shared))
    (export "wasm_hit" (func $hit))
    (export "wasm_miss" (func $miss))

    (export "access_set" (func $access_set))
    (export "probe" (func $probe))
    (export "bprobe" (func $bprobe))
    (export "time_element" (func $time_element))

    (func $hit (param $victim i32) (param $other i32) (param $ptr i32)(result i64)
        (local $t0 i64)
        (local $t1 i64)
        (local $td i64)
        ;; acces victim
        (set_local $td (i64.load (i32.and (i32.const 0xffffffff) (get_local $other))))
        ;; t0 (mem[0])
        (set_local $t0 (i64.load (i32.and (i32.const 0xffffffff) (i32.or (i32.const 256) (i32.eqz (i64.eqz (get_local $td)))))))
        ;; re-access
        (set_local $td (i64.load (i32.and (i32.const 0xffffffff) (i32.or (get_local $victim) (i64.eqz (get_local $t0))))))
        ;; t1 (mem[0])
        (set_local $t1 (i64.load (i32.and (i32.const 0xffffffff) (i32.or (i32.const 256) (i32.eqz (i64.eqz (get_local $td)))))))
		;; traverse
        (set_local $td (i64.extend_u/i32 (i32.or (i32.eqz (i64.eqz (get_local $td))) (get_local $ptr))))
        (loop $iter
            (set_local $td (i64.load (i32.wrap/i64 (get_local $td))))
            (br_if $iter (i32.eqz (i64.eqz (get_local $td)))))
        (i64.sub (get_local $t1) (get_local $t0))
        return)

    (func $time_element
        (param $element i32)
        (result i64)
        
        (local $t0 i64)
        (local $t1 i64)
        (local $td i64)
        
        ;; access victim
        (set_local $t0 (i64.load (i32.const 256)))
        (set_local $td (i64.load (i32.and (i32.const 0xffffffff) (i32.or (get_local $element) (i64.eqz (get_local $t0))))))
        (set_local $t1 (i64.load (i32.and (i32.const 0xffffffff) (i32.or (i32.const 256) (i32.eqz (i64.eqz (get_local $td)))))))

        (i64.sub (get_local $t1) (get_local $t0))
        return)

    (func $access_set (param $ptr i32) (result i64)
		;; traverse

        (local $td i64)
        (set_local $td (i64.extend_u/i32 (get_local $ptr)))
        (loop $iter
            (set_local $td (i64.load (i32.wrap/i64 (get_local $td))))
            (br_if $iter (i32.eqz (i64.eqz (get_local $td)))))
        
        (get_local $td)
        return
    )

    (func $bprobe
        (param $ptr i32)
        (param $threshold i32)
       
        (result i32)

        (local $start i32)
        (local $end i32)
        (local $chain i32)
        (local $count i32)
        (set_local $count (i32.const 0))

        (loop $iter
            (set_local $start (i32.load (i32.and (i32.const 0xffffffff) (i32.or (i32.const 256) (i32.eqz (get_local $ptr))))))
            
            (set_local $ptr (i32.load (i32.and (i32.const 0xffffffff) (i32.or (i32.add (i32.const 8) (get_local $ptr)) (i32.eqz (get_local $start))))))

            (set_local $end (i32.load (i32.and (i32.const 0xffffffff) (i32.or (i32.const 256) (i32.eqz (get_local $ptr))))))

            (if 
                (i32.gt_u (i32.sub (get_local $end) (get_local $start)) (get_local $threshold))
                (then (set_local $count (i32.add (i32.const 1) (get_local $count))))
            )  
            
            (br_if $iter (i32.eqz (i32.eqz (get_local $ptr)))))

        (return (get_local $count))
    )

    (func $probe
        (param $ptr i32)
        (param $threshold i32)
       
        (result i32)

        (local $start i32)
        (local $end i32)
        (local $chain i32)
        (local $count i32)
        (set_local $count (i32.const 0))

        (loop $iter
            (set_local $start (i32.load (i32.and (i32.const 0xffffffff) (i32.or (i32.const 256) (i32.eqz (get_local $ptr))))))
            
            (set_local $ptr (i32.load (i32.and (i32.const 0xffffffff) (i32.or (get_local $ptr) (i32.eqz (get_local $start))))))

            (set_local $end (i32.load (i32.and (i32.const 0xffffffff) (i32.or (i32.const 256) (i32.eqz (get_local $ptr))))))

            (if 
                (i32.gt_u (i32.sub (get_local $end) (get_local $start)) (get_local $threshold))
                (then (set_local $count (i32.add (i32.const 1) (get_local $count))))
            )  
            
            (br_if $iter (i32.eqz (i32.eqz (get_local $ptr)))))

        (return (get_local $count))
    )

    (func $miss (param $victim i32) (param $ptr i32) (result i64)
        (local $t0 i64)
        (local $t1 i64)
        (local $td i64)
        ;; acces victim
        (set_local $td (i64.load (i32.and (i32.const 0xffffffff) (get_local $victim))))
		;; traverse
        (set_local $td (i64.extend_u/i32 (i32.or (i32.eqz (i64.eqz (get_local $td))) (get_local $ptr))))
        (loop $iter
            (set_local $td (i64.load (i32.wrap/i64 (get_local $td))))
            (br_if $iter (i32.eqz (i64.eqz (get_local $td)))))
        ;; t0 (mem[0])

        (set_local $t0 (i64.load (i32.and (i32.const 0xffffffff) (i32.or (i32.const 256) (i32.eqz (i64.eqz (get_local $td)))))))
        ;; re-access
        (set_local $td (i64.load (i32.and (i32.const 0xffffffff) (i32.or (get_local $victim) (i64.eqz (get_local $t0))))))
        ;; t1 (mem[0])
        (set_local $t1 (i64.load (i32.and (i32.const 0xffffffff) (i32.or (i32.const 256) (i32.eqz (i64.eqz (get_local $td)))))))
        
        (i64.sub (get_local $t1) (get_local $t0))
        return)
)
