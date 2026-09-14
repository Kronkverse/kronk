# Comments are not posts

> **Status:** exploration, 2026-09-14. Opened by Tal — "comments should
> definitely be different to posts" — after noticing that search returns a
> reply and a post as the same kind of thing. Nothing here is decided; the
> numbers are measured from the live instance.

## The state of it

A comment is a post with a parent. One table, one model, one word. That is
Mastodon's design and Kronk inherited it whole.

Except Kronk has already stopped believing it, in behaviour if not in
vocabulary:

- **The home feed drops every reply.** `FeedManager#filter_from_home` opens
  with a bare `return :filter if status.reply?` — a Kronk addition, sitting
  above Mastodon's much more nuanced rules about which replies to show, which
  are now unreachable. The feed's position is absolute: a comment is not feed
  content.
- **Nudges already names it.** A reply to your post fires `status.replied`,
  its own event, distinct from a froth or a mention.
- **Korners keep growing their own.** Kuestions answers are a dedicated model
  precisely because a reply could not carry the answer-before-you-read rule.
  Album photo comments were dropped when photos became status-backed. Kommons
  proposal comments are declared and deliberately deferred. Every time a
  korner has needed a comment, it has built something that is not a reply.
- **Search is the exception.** Replies are indexed, returned, and labelled
  "Post", indistinguishable from a top-level one. It is the only surface that
  still insists the two are the same thing.

So the concept already exists. It is enforced in three places, named in one,
and modelled in none.

## What the data says

From the live instance (2026-09-14), 2,614 posts:

|                                  | Count | Share                 |
| -------------------------------- | ----- | --------------------- |
| Top-level posts                  | 1,278 | 49%                   |
| Replies                          | 1,336 | **51%**               |
| …replies to a reply              | 610   | 46% of replies        |
| …replies to your own post        | 330   | 25% of replies        |
| …carrying media                  | 187   | 14% of replies        |
| Distinct people who have replied | 124   | of 108 local accounts |
| Longest single thread            | 15    |                       |

Three things fall out of that.

**Half the content is replies.** Whatever a comment turns out to be, it is not
a minor case, and a decision that treats it as second-class content is a
decision about half of everything on Kronk.

**"Comment" is not one shape.** At least three behaviours are wearing the same
clothes:

1. **A reply to someone else** — the thing everyone means by "comment".
2. **A reply to your own post** (330). Not a comment at all; a continuation.
   Someone finishing a thought, or threading a longer piece.
3. **A reply to a reply** (610). A conversation, where the parent post is
   context rather than subject.

**Depth is normal.** 46% of replies are replies to replies. Any model that
assumes one flat layer of comments under a post is wrong about nearly half of
them on day one.

## The actual question

Not "should comments look different" — they should, and that costs nothing.
The question is **what a comment is**, and there are three honest answers:

### 1. A post with a flag

Keep one table, derive the distinction (`in_reply_to_id.present?`), and let
every surface decide how to treat it. This is what exists, minus the pretence
that they are the same.

Cheap, reversible, and honest about the fact that a reply really is a post
with a parent. But it leaves every surface to make its own decision, which is
how search ended up disagreeing with the feed.

### 2. A post with a type

`post_type` already exists as an enum on Status (`normal`, `question`,
`answer`, `proposal`, `album_photo`). A comment would be a value in it, set at
creation, indexed, filterable everywhere.

More work, but it puts the answer in one place and lets a korner say "my thing
accepts comments" without inventing its own. It also fits the direction
korners have already been walking.

### 3. Its own model

Comments become a table, with their own reach rules, their own lifecycle,
their own relationship to the thing they are on — like Kuestions answers.

The most expressive and by far the most expensive: 1,336 existing rows to
migrate, threading to rebuild, and everything that reads a status timeline to
teach. Worth it only if a comment turns out to need rules a post cannot carry.

## What has to be decided, and only by Tal

- **Does a comment have its own reach?** Today a reply carries its own
  visibility, independent of its parent — you can write a mates-only reply to
  a public post. Should a comment instead inherit the audience of the thing it
  is on? That single answer decides most of the rest.
- **Is a self-reply a comment?** 330 of them. If continuing your own thought is
  a different act from commenting on someone else's, the model needs to say so.
- **Do comments belong to their korner?** A comment on an album, on an event,
  on a proposal — is that the same object as a comment on a post, or does each
  korner keep its own as Kuestions did?
- **Where can a comment appear on its own?** The feed says nowhere. Search
  currently says everywhere. A profile shelf, a korner page, a search result —
  each needs an answer, and "wherever a post can" is not obviously right for
  something that is meaningless without its parent.

## How to explore it

Cheapest first, and let the real data argue.

1. **Name them where they already differ.** Search now labels a comment as a
   Comment rather than a Post — one line, no schema, no migration, and it
   makes the question visible against 1,336 real replies. _(Done.)_
2. **Look at it.** Search for a word that appears in both. Does knowing "this
   is a comment" change what you click? Does a comment out of its thread read
   as useful or as noise?
3. **Give a comment its parent.** A comment result showing what it is replying
   to is the next cheapest step and probably the one that settles whether they
   belong in search at all.
4. **Only then choose a model.** By that point the question stops being
   architectural and starts being obvious.

The order matters because the expensive decision — 1, 2 or 3 above — is much
easier to make after looking at labelled comments in a real search than before.
