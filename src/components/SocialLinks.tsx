import { isCEP } from '../lib/ae';
const profiles = [
  { name: 'TikTok', url: 'https://www.tiktok.com/@madebykhua' },
  { name: 'Instagram', url: 'https://www.instagram.com/madebykhua/' },
  { name: 'YouTube', url: 'https://www.youtube.com/@madebykhua' },
];
export function SocialLinks({ onError }: { onError: (message: string, error?: boolean) => void }) {
  return (
    <nav className="social-links" aria-label="Made by Khua social profiles">
      {profiles.map((profile) => (
        <a
          key={profile.name}
          href={profile.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={profile.name + ' @madebykhua'}
          onClick={(event) => {
            if (!isCEP()) return;
            event.preventDefault();
            try {
              const result = new CSInterface().openURLInDefaultBrowser(profile.url);
              if (result !== 0)
                throw new Error('Could not open ' + profile.name + '. Visit ' + profile.url);
            } catch (error) {
              onError(error instanceof Error ? error.message : String(error), true);
            }
          }}
        >
          <span>{profile.name}</span>
          <small>@madebykhua</small>
        </a>
      ))}
    </nav>
  );
}
