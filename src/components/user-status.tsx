import { authClient } from '@/lib/auth-client'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface UserStatusProps {
  user: {
    name: string
    email: string
  }
}

export function UserStatus({ user }: UserStatusProps) {
  const handleSignOut = async () => {
    await authClient.signOut()
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-center text-lg">Welcome!</CardTitle>
        <CardDescription className="text-center">
          You are signed in
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-2 text-center">
          <p className="font-medium">{user.name}</p>
          <p className="text-muted-foreground text-sm">{user.email}</p>
        </div>
      </CardContent>

      <CardFooter>
        <Button variant="outline" onClick={handleSignOut} className="w-full">
          Sign out
        </Button>
      </CardFooter>
    </Card>
  )
}


