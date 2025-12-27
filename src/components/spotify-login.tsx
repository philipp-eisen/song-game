import { SpotifyLogo } from '@phosphor-icons/react'
import { authClient } from '@/lib/auth-client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function SpotifyLogin() {
  const handleSpotifyLogin = async () => {
    await authClient.signIn.social({ provider: 'spotify' })
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-center text-lg">Song Game</CardTitle>
        <CardDescription className="text-center">
          Sign in with your Spotify account to continue
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Button
          onClick={handleSpotifyLogin}
          className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-white"
        >
          <SpotifyLogo weight="duotone" className="mr-2 size-5" />
          Log in with Spotify
        </Button>
      </CardContent>
    </Card>
  )
}

