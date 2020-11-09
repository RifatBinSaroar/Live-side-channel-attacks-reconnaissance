#!/usr/bin/bash

touch output.txt

google-chrome --user-data-dir=/tmp/tmp.u9lo18kaTh --js-flags='--allow-natives-syntax --experimental-wasm-bigint' http://localhost:8080  | ./verify_addr.sh > output.txt &

#PID = $!
#echo $PID
#ps axu | grep google

tail -F output.txt | while read myline; do 
echo ${myline}

if [ $myline -eq 0 ]; then
  killall --quiet --signal 15 -- chrome
  echo "The End"
  #kill $PID
  exit
  # ps -ef | grep google-chrome | grep -v grep | awk '{print $2}' | xargs kill
fi;
done

