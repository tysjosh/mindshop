import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          MindShop Developer Portal
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Integrate powerful AI-driven product recommendations and customer
          support into your e-commerce platform.
        </p>
        <div className="flex gap-4">
          <Button asChild size="lg">
            <Link href="/login">Get Started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/documentation">View Documentation</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
