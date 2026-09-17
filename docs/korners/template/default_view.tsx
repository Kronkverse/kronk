// Default view — rendered at bare /hub/mykorner (the first entry in
// the manifest's `views:` list). Owns its own content: cards, panels,
// composer, whatever the korner does. NOT its title, tagline, or the
// tab row — those come from the Frame.

export const DefaultView: React.FC = () => (
  <div className='mykorner__view'>
    <p>Default view — replace with the korner's actual content.</p>
  </div>
);
