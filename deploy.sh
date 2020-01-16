mkdocs build

echo ">>>>>>> build success"

git checkout master

rm -rf docs/ mkdocs.yml serve.sh deploy.sh

echo ">>>>>>> copy site to root .."
cp -a site/* .
echo ">>>>>>> copy site to root success"

git add .

echo ">>>>>>> ready commit in master"
echo ">>>>>>> exec git status ."

git status .

echo ">>>>>>> exec commit"
git commit -m 'deploy from mkdocs'

git push 

git checkout mkdocs