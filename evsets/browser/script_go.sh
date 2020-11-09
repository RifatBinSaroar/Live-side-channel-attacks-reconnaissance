#!/bin/bash
# Basic if statement

touch entry.txt



sh test.sh
sleep 2

EVICTION="$(tail -3 output.txt | head -1)"
RUNTIME="$(tail -2 output.txt | head -1)"
ENTRY="${EVICTION},${RUNTIME}"


echo $ENTRY > entry.txt




for i in {1..99}
do

	sh test.sh
	sleep 2
	EVICTION="$(tail -3 output.txt | head -1)"
	RUNTIME="$(tail -2 output.txt | head -1)"
	ENTRY="${EVICTION},${RUNTIME}"

	echo $ENTRY >> entry.txt

	echo "in the loop"

done

vi entry.txt
