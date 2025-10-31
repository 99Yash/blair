'use client';

import { useRouter } from 'next/navigation';
import React from 'react';
import { toast } from 'sonner';
import * as z from 'zod/v4';
import { Button } from '~/components/ui/button';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Spinner } from '~/components/ui/spinner';
import { authClient } from '~/lib/auth/client';
import { AuthOptionsType } from '~/lib/constants';
import {
  getErrorMessage,
  getLocalStorageItem,
  setLocalStorageItem,
} from '~/lib/utils';

const signInSchema = z.object({
  email: z.email().max(255, 'Email must be less than 255 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters'),
});

const signUpSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters'),
  email: z.email().max(255, 'Email must be less than 255 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters'),
});

type EmailSignInProps = z.infer<typeof signInSchema>;

type EmailSignUpProps = z.infer<typeof signUpSchema>;

interface EmailSignInComponentProps {
  isSignUp?: boolean;
  onToggleMode?: () => void;
}

export function EmailSignIn({
  isSignUp = false,
  onToggleMode,
}: EmailSignInComponentProps) {
  const router = useRouter();
  const [lastAuthMethod, setLastAuthMethod] =
    React.useState<AuthOptionsType | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const lastAuthMethod = getLocalStorageItem('LAST_AUTH_METHOD');
      setLastAuthMethod(lastAuthMethod ?? null);
    }
  }, []);

  const [isLoading, setIsLoading] = React.useState(false);

  const [formErrors, setFormErrors] = React.useState<Record<string, string>>(
    {}
  );

  const handleSignIn = React.useCallback(
    async ({ email, password }: EmailSignInProps) => {
      setIsLoading(true);
      try {
        const { error } = await authClient.signIn.email({
          email,
          password,
          rememberMe: true,
          callbackURL: '/create',
        });

        if (error) {
          setIsLoading(false);
          toast.error(error.message);
          return;
        }

        // Persist last used auth method
        if (typeof window !== 'undefined') {
          setLocalStorageItem('LAST_AUTH_METHOD', 'EMAIL');
        }

        router.push('/');
        toast.success('Successfully signed in!');
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    },
    [router]
  );

  const handleSignUp = React.useCallback(
    async ({ name, email, password }: EmailSignUpProps) => {
      setIsLoading(true);
      try {
        const { error } = await authClient.signUp.email({
          name,
          email,
          password,
          image: `https://avatar.vercel.sh/${encodeURIComponent(name)}`, // Generate avatar from name
          callbackURL: '/create',
        });

        if (error) {
          setIsLoading(false);
          toast.error(error.message);
          return;
        }

        // Persist last used auth method
        if (typeof window !== 'undefined') {
          setLocalStorageItem('LAST_AUTH_METHOD', 'EMAIL');
        }
        toast.success('Account created successfully!');
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    },
    [router]
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const formObject = Object.fromEntries(formData);
    const schema = isSignUp ? signUpSchema : signInSchema;
    const { success, data, error } = schema.safeParse(formObject);

    // Clear previous errors
    setFormErrors({});

    if (!success) {
      // Set field-level errors
      const fieldErrors: Record<string, string> = {};
      error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message;
        }
      });

      setFormErrors(fieldErrors);

      // Show first error as toast
      if (error.issues.length > 0) {
        toast.error(error.issues[0].message);
      }

      return;
    }

    if (isSignUp) {
      await handleSignUp(data as EmailSignUpProps);
    } else {
      await handleSignIn(data as EmailSignInProps);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit}>
        <FieldSet>
          <FieldGroup>
            {isSignUp && (
              <Field data-invalid={!!formErrors.name}>
                <FieldLabel htmlFor="name">Full name</FieldLabel>
                <FieldContent>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Your full name"
                    type="text"
                    autoCapitalize="words"
                    autoComplete="name"
                    autoCorrect="off"
                    className="bg-background"
                    aria-invalid={!!formErrors.name}
                    required
                  />
                  <FieldError
                    errors={
                      formErrors.name
                        ? [{ message: formErrors.name }]
                        : undefined
                    }
                  />
                  <FieldDescription>
                    This will be displayed on your profile
                  </FieldDescription>
                </FieldContent>
              </Field>
            )}

            <Field data-invalid={!!formErrors.email}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <FieldContent>
                <Input
                  id="email"
                  name="email"
                  placeholder="name@example.com"
                  type="email"
                  autoCapitalize="none"
                  autoComplete={isSignUp ? 'username' : 'email'}
                  autoCorrect="off"
                  className="bg-background"
                  aria-invalid={!!formErrors.email}
                  required
                />
                <FieldError
                  errors={
                    formErrors.email
                      ? [{ message: formErrors.email }]
                      : undefined
                  }
                />
                <FieldDescription>
                  We will never share your email with anyone
                </FieldDescription>
              </FieldContent>
            </Field>

            <Field data-invalid={!!formErrors.password}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <FieldContent>
                <Input
                  id="password"
                  name="password"
                  placeholder="Enter your password"
                  type="password"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  className="bg-background"
                  aria-invalid={!!formErrors.password}
                  required
                />
                <FieldError
                  errors={
                    formErrors.password
                      ? [{ message: formErrors.password }]
                      : undefined
                  }
                />
                <FieldDescription>
                  Password must be at least 8 characters long
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>

          <Button disabled={isLoading} type="submit" className="relative">
            {isLoading ? (
              <Spinner className="mr-2 bg-background" />
            ) : isSignUp ? (
              'Create Account'
            ) : (
              'Sign In with Email'
            )}

            {lastAuthMethod === 'EMAIL' && (
              <i className="text-xs absolute right-4 text-muted text-center">
                Last used
              </i>
            )}
          </Button>
        </FieldSet>
      </form>

      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            onToggleMode?.();
            setFormErrors({}); // Clear errors when switching modes
          }}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
        >
          {isSignUp
            ? 'Already have an account? Sign in'
            : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
}
