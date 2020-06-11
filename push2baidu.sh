#!/bin/bash

echo "push2baidu executing ..."

FILE=urls.txt
rm -f $FILE

cmd=`grep loc sitemap.xml  | awk -F ">" '{print $2}' | awk -F "<" '{print $1}'`

for line in $cmd; do
    echo $line >> $FILE
done

echo "pushing urls to baidu"

curl -H 'Content-Type:text/plain' --data-binary @urls.txt "http://data.zz.baidu.com/urls?site=https://blog.yorek.xyz&token=XAt9QHfqMXWRRMoU"

echo "push completed."

rm -f $FILE