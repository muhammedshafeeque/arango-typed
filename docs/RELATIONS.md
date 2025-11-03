# Relationships

Arango Typed supports various relationship types similar to Mongoose and other ORMs.

## HasOne (One-to-One)

```typescript
import { hasOne } from 'arango-typed';

const User = model('users', userSchema);
const Profile = model('profiles', profileSchema);

// User has one Profile
User.hasOne('profile', Profile, {
  foreignKey: 'userId'
});

// Usage
const user = await User.findById('users/123');
const profile = await user.populate('profile');
console.log(profile.bio);
```

## HasMany (One-to-Many)

```typescript
import { hasMany } from 'arango-typed';

const User = model('users', userSchema);
const Post = model('posts', postSchema);

// User has many Posts
User.hasMany('posts', Post, {
  foreignKey: 'userId'
});

// Usage
const user = await User.findById('users/123');
const posts = await user.populate('posts');
posts.forEach(post => console.log(post.title));
```

## BelongsTo (Many-to-One)

```typescript
import { belongsTo } from 'arango-typed';

const Post = model('posts', postSchema);
const User = model('users', userSchema);

// Post belongs to User
Post.belongsTo('author', User, {
  foreignKey: 'userId'
});

// Usage
const post = await Post.findById('posts/456');
const author = await post.populate('author');
console.log(author.name);
```

## BelongsToMany (Many-to-Many)

```typescript
import { belongsToMany } from 'arango-typed';

const User = model('users', userSchema);
const Role = model('roles', roleSchema);

// User belongs to many Roles
User.belongsToMany('roles', Role, {
  through: 'user_roles', // Edge collection
  foreignKey: '_from',
  otherKey: '_to'
});

// Usage
const user = await User.findById('users/123');
const roles = await user.populate('roles');
roles.forEach(role => console.log(role.name));
```

## Polymorphic Relations

```typescript
import { polymorphic } from 'arango-typed';

const Comment = model('comments', commentSchema);
const Post = model('posts', postSchema);
const Video = model('videos', videoSchema);

// Comment can belong to Post or Video
Comment.polymorphic('commentable', {
  types: [Post, Video],
  typeField: 'commentableType',
  idField: 'commentableId'
});

// Usage
const comment = await Comment.findById('comments/789');
const commentable = await comment.populate('commentable');
// commentable could be Post or Video
```

## Populating Multiple Relations

```typescript
// Populate multiple relations at once
const user = await User.findById('users/123')
  .populate('profile')
  .populate('posts')
  .populate('roles')
  .exec();

// Or use array
const user = await User.findById('users/123')
  .populate(['profile', 'posts', 'roles'])
  .exec();
```

## Nested Population

```typescript
// Populate nested relations
const post = await Post.findById('posts/456')
  .populate('author')
  .populate('comments.commenter') // Nested
  .exec();
```

## Query Relations

```typescript
// Query through relations
const activeUsers = await User.find()
  .whereHas('posts', (query) => {
    query.where('published', true);
  })
  .all();

// Or using join
const usersWithPosts = await User.find()
  .join('posts', 'users._id', 'posts.userId')
  .where('posts.published', true)
  .all();
```

