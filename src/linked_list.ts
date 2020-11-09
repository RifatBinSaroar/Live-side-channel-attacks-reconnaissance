class LinkedListView {
    public static PREVIOUS = 8;

    public buffer: DataView;
    public first: number;
    public last: number;
    public length: number;

    public constructor(buffer: DataView, forward: number, backward: number, length: number){
        this.buffer = buffer;
        this.first = forward;
        this.last = backward;
        this.length = length;
    }

    public toArray(){
        const output = [];

        let index = this.first;
        while(index !== this.last && index !== 0){
            output.push(index);
            index = this.next(index);
        }
        output.push(index);

        return output;
    }

    public next(element: number){
        return this.buffer.getUint32(element, true);
    }

    public prev(element: number){
        return this.buffer.getUint32(element + LinkedList.PREVIOUS, true);
    }
}

class LinkedList extends LinkedListView {
    public constructor(buffer: DataView, elements: number[]){
        super(buffer, elements[0], elements[elements.length - 1], elements.length);
        this.set(elements);
    }

    public set(elements: number[]){
        this.first = elements[0];
        this.last = elements[elements.length - 1];
        this.length = elements.length;

        this.buffer.setUint32(elements[0] + LinkedList.PREVIOUS, 0, true);
        for(let i = 1; i < elements.length; i++){
            this.buffer.setUint32(elements[i - 1], elements[i], true);
            this.buffer.setUint32(elements[i] + LinkedList.PREVIOUS, elements[i - 1], true);
        }
        this.buffer.setUint32(elements[elements.length - 1], 0, true);
    }

    public chunkN(chunks: number): LinkedListView[] {
        const chunkSize = Math.floor(this.length / chunks);
        const bigChunks = this.length % chunks;

        let begin = this.first;

        const output = [];

        for(let chunk = 0; chunk < chunks; chunk++){
            let size = (chunk < bigChunks ? 1 : 0) + chunkSize;
            let end = begin;

            for(let i = 1; i < size; i++){
                end = this.buffer.getUint32(end, true);
            }

            output.push(new LinkedListView(this.buffer, begin, end, size));

            begin = this.buffer.getUint32(end, true);
        }

        return output;
    }

    public unlinkView(view: LinkedListView){
        this.link(this.prev(view.first), this.next(view.last));

        this.length -= view.length;
    }

    public relinkView(view: LinkedListView){
        this.link(this.prev(view.first), view.first);
        this.link(view.last, this.next(view.last));

        this.length += view.length;
    }

    protected link(head: number, tail: number){
        if(head === 0){
            this.first = tail;
        } else {
            this.buffer.setUint32(head, tail, true);
        }

        if(tail === 0){
            this.last = head;
        } else {
            this.buffer.setUint32(tail + LinkedList.PREVIOUS, head, true);
        }
    }

    public pushBack(element: number) {
        this.link(this.last, element);
        this.link(element, 0);
        this.length++;
    }

    public popBack(): number | undefined {
        if(this.length === 0){
            return undefined;
        }

        const result = this.last;
        this.link(this.prev(this.last), 0);
        this.length--;
        return result;
    }
}