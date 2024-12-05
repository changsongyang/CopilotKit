#!/usr/bin/env bash
set -e  # Exit immediately if a command exits with a non-zero status.

# load .env.local if present
if [ -f .env.local ]; then
  set -a # automatically export all variables
  source .env.local
  set +a # stop automatically exporting
fi

# save the current branch
current_branch=$(git branch --show-current)

# quit if the current branch is main
if [ "$current_branch" = "main" ]; then
  printf "\e[41m\e[97m!!\e[0m Error: Can't release pre release from main branch\n"
  exit 1
fi

# check if branch starts with "pre/"
if [[ $current_branch == pre/* ]]; then
  suggested_tag="alpha"
  echo "You are in a branch starting with 'alpha/'. Therefore, the suggested tag is 'alpha'. You can override this."
  read -p "Enter tag (suggested: \"alpha\" - press Enter to confirm): " tag
  # ${tag:-pre} means use $tag if set, otherwise use "pre" as the default value
  tag=${tag:-"alpha"}
else
  read -p "Enter tag (e.g. some-feature): " user_input
  tag=${user_input}
fi

if [ -z "$tag" ]; then
  printf "\e[41m\e[97m!!\e[0m Error: Tag cannot be empty\n"
  exit 1
fi

echo ""
echo "Branch: $current_branch" 
echo "Tag: $tag"
echo ""
echo "==============================="
echo "!! Releasing new pre release !!"
echo "==============================="
echo ""

echo "Continue? (y/n)"
read -r response
if [ "$response" != "y" ]; then
  printf "\e[41m\e[97m!!\e[0m Error: Aborted"
  exit 1
fi




# enter pre mode
pnpm changeset pre enter alpha

# select the packages to push an update for
pnpm changeset

# bump the version
pnpm changeset version

echo "Commit and run CI? (y/n)"
read -r response
if [ "$response" != "y" ]; then
  printf "\e[41m\e[97m!!\e[0m Error: Aborted"
  exit 1
fi

# Stage and commit
git add -A && git commit -m "Pre release $current_branch" && git push
