'use client';
import React from 'react';

export const ClerkProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export const useAuth = () => ({
  isLoaded: true,
  userId: 'mock-user-id',
  signOut: async () => { console.log('Mock sign out'); },
});

export const useUser = () => ({
  isLoaded: true,
  user: {
    id: 'mock-user-id',
    fullName: 'Mock User',
    primaryEmailAddress: { emailAddress: 'mock@example.com' },
  }
});

export const UserButton = (props: any) => <div className="p-2 bg-slate-200 rounded text-xs font-bold">User</div>;
export const SignIn = (props: any) => <div>Mock SignIn</div>;
export const SignUp = (props: any) => <div>Mock SignUp</div>;
