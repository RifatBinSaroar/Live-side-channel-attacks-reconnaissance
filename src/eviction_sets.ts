type Evicts = (victim: number, ptr: number) => boolean;

const CANDIDATES_START          = 4096 * 10;            // Start of the eviction set in the buffer
const CANDIDATES_END            = 4096 * (16 * 1000);   // End of the eviction set in the buffer
const STRIDE                    = 4096;                 // Distance between elements
const OFFSET                    = 0;                    // Offset in the page (Evicts addresses that share the 6 LSBs of the cache index)
const ASSOCIATIVITY             = 16;                   // Associativity of the cache
const CANDIDATE_COUNT           = 8000;                 // The number of candidates to select after shuffling
const INITIAL_CONFLICT_SIZE     = 800;                  // The initial size of the conflict set
const RETRY_SET_REDUCTION       = 20;                   // The number of times to retry the reduction step inside EvictionSet.reduce before giving up
const RETRY_SET_CONSTRUCTION    = 20;                   // The number of times to retry set construction inside EvictionSet.generateAll before giving up
const SHUFFLE_AFTER_FAILURE     = true;                 // Shuffle the eviction set each time construction fails

interface Backend {
    threshold: number;
    probe(set: EvictionSet, threshold: number): number;
    bprobe(set: EvictionSet, threshold: number): number;
}

class EvictionSet extends LinkedList {
    public victims = new Array<number>();

    // Generate eviction sets for all cache sets
    public static generateAll(view: DataView, evicts: Evicts, backend: Backend){
        const {candidates, witnesses} = EvictionSet.generateConflictSet(view, evicts);

        const sets = [];
        let attempt = 0;
        while(attempt++ < RETRY_SET_CONSTRUCTION && candidates.length >= ASSOCIATIVITY && witnesses.length > 0)
        {
            const witness = EvictionSet.findNextWitness(witnesses, sets, evicts);
            
            if(witness === undefined){
                break;
            }
            
            // The eviction set 'candidates' evicts our 'witness' from the cache.
            //  Reduce the eviction set to the minimal elements needed to evict 'witness'
            const set = new EvictionSet(view, candidates);
            if(!EvictionSet.reduce(witness, set, evicts)){
                // Did not successfully reduce the eviction set
                witnesses.push(witness);

                if(SHUFFLE_AFTER_FAILURE){
                    EvictionSet.shuffle(candidates);
                }
                continue;
            }
            attempt = 0;

            // Remove the set we just found from candidates
            for(const element of set.toArray()){
                const index = candidates.indexOf(element);
                candidates[index] = candidates[candidates.length - 1];
                candidates.pop();
            }

            set.victims.push(witness);
            sets.push(set);
        }

	return new EvictionSets(backend, sets);
    }

    // Find a set that evicts the given victim
    public static findEvictingSet(victim: number, sets: EvictionSet[], evicts: Evicts){
        for(const set of sets){
            if(evicts(victim, set.first)){
                return set;
            }
        }

        return undefined;
    }

    private static shuffle<T>(array: T[]) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    protected static generateConflictSet(view: DataView, evicts: Evicts){
        // Create the list of candidate elements
        const candidates = new Array<number>();
        for(let i = CANDIDATES_START + (OFFSET << 6); i < CANDIDATES_END; i += STRIDE){
            candidates.push(i);
        }
        EvictionSet.shuffle(candidates);

        candidates.length = Math.min(candidates.length, CANDIDATE_COUNT);
        
        // Generate a conflict set
        const set = new LinkedList(view, candidates.splice(-INITIAL_CONFLICT_SIZE));
        const witnesses = [];

        while(candidates.length > 0){
            const candidate = candidates.pop()!;
            view.setUint32(candidate, 0, true);

            if(evicts(candidate, set.first)){
                witnesses.push(candidate);
            } else {
                set.pushBack(candidate);
            }
        }

        return {
            candidates: set.toArray(),
            witnesses: witnesses,
        }
    }

    // Linear set-reduction algorithm - Vila et al. "Theory and Practice of Finding Eviction Sets"
    //  https://github.com/cgvwzq/evsets
    protected static reduce(victim: number, set: LinkedList, evicts: Evicts){
        let attempt = 0;

        while(attempt++ < RETRY_SET_REDUCTION && set.length > ASSOCIATIVITY){
            // By splitting into associativity + 1 chunks, we can find at least ONE chunk that does not contain an element
            //  that belongs in our final eviction set.
            const chunks = set.chunkN(ASSOCIATIVITY + 1);

            for(const chunk of chunks){
                set.unlinkView(chunk);

                if(evicts(victim, set.first)){
                    // Set evicted victim
                    //  Therefore, we do NOT need the elements in this chunk to evict the victim.
                    //  Discard the chunk.
                    attempt = 0;
                    break;
                } else {
                    // Set did NOT evict victim.
                    //  Therefore, we DO need the elements in this chunk to evict the victim.
                    //  Keep the chunk.
                    set.relinkView(chunk);
                }
            }
        }

        return set.length === ASSOCIATIVITY;
    }

    // Iterates over bits of the physical address we can access and generate new eviction sets from existing sets
    protected static expandSets(view: DataView, sets: EvictionSet[]){
        const output = [];

        for(const set of sets){
            output.push(set);
            const elements = set.toArray();

            // Do we need configuration for this?
            for(let i = 64; i < 4096; i += 64){
                const next = new EvictionSet(view, elements.map(x => x + i));
                next.victims = set.victims.map(x => x + i);
                output.push(next);
            }
        }

        return output;
    }

    protected static findNextWitness(witnesses: number[], sets: EvictionSet[], evicts: Evicts){
        while(witnesses.length > 0){
            const witness = witnesses.pop()!;
            const set = EvictionSet.findEvictingSet(witness, sets, evicts);

            if(set === undefined){
                return witness;
            }

            set.victims.push(witness);
        }

        return undefined;
    }
}

class EvictionSets {
    public readonly backend: Backend;
    public readonly sets: ReadonlyArray<EvictionSet>;

    public constructor(
        backend: Backend,
        sets: ReadonlyArray<EvictionSet>
    ){
        this.backend = backend;
        this.sets = sets;
    }

    // Creates output suitable for https://github.com/cgvwzq/evsets/blob/master/browser/verify_addr.sh
    public static toValidationString(sets: EvictionSets, log: (text: string) => void){
        log('Prepare new evset');
        for(const set of sets.sets){
            const elements = set.toArray()
                .map(x => String(x))
                .join(',');

            log('Eviction set: ' + elements);
        }
    }
}
