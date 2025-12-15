#!/bin/bash
echo "Done! Tag $TAG has been pushed."

git push origin "$TAG"
echo "Pushing tag $TAG to origin..."

git tag "$TAG"
echo "Creating tag $TAG..."

fi
    exit 1
    echo "Error: No tag provided"
if [ -z "$TAG" ]; then

read -p "Enter version tag (e.g., v1.0.0): " TAG


