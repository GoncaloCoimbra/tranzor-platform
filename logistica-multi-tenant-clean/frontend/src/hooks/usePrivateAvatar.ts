import { useEffect, useState } from 'react';
import api from '../api/api';

export function usePrivateAvatar(avatarUrl?: string) {
  const [privateUrl, setPrivateUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;

    if (!avatarUrl) {
      setPrivateUrl(null);
      return;
    }

    void api
      .get('/auth/avatar', { responseType: 'blob' })
      .then((response) => {
        objectUrl = URL.createObjectURL(response.data);
        if (active) setPrivateUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((error: unknown) => {
        if (active) {
          console.error(
            'Unable to load authenticated avatar',
            error instanceof Error ? error.message : 'Unknown error',
          );
        }
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [avatarUrl]);

  return privateUrl;
}
