'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/context/auth-context'
import { Button } from '@/components/ui/button'
import { InputField } from '@/components/ui/input-field'
import { Alert } from '@/components/ui/alert'
import Link from 'next/link'
import { Checkbox } from '../ui/checkbox'
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"


export const LoginForm: React.FC = () => {
    const router = useRouter()
    const { user, signIn, error, isLoading, clearError } = useAuth()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
    const [succeeded, setSucceeded] = useState(false)

    useEffect(() => {
        if (user) {
            router.replace('/dashboard')
        }
    }, [router, user])

    if (user || isLoading) {
        return (
            <div className="w-full max-w-md mx-auto p-8 bg-white dark:bg-[#172B4D] rounded-2xl border border-gray-200 dark:border-[#344563] shadow-lg flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
        )
    }

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {}

        if (!email) {
            errors.email = 'Email is required'
        } else if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            errors.email = 'Invalid email address'
        }

        if (!password) {
            errors.password = 'Password is required'
        }

        setValidationErrors(errors)
        return Object.keys(errors).length === 0
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        clearError()

        if (!validateForm()) return

        try {
            await signIn(email, password)
            setSucceeded(true)
            await new Promise(r => setTimeout(r, 700))
            router.push('/dashboard')
        } catch (err) {
            console.error('Login error:', err)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        if (name === 'email') setEmail(value)
        else if (name === 'password') setPassword(value)

        if (validationErrors[name]) {
            setValidationErrors(prev => ({ ...prev, [name]: '' }))
        }
    }

    return (
        <div className="w-full max-w-md mx-auto p-8 bg-white dark:bg-[#172B4D] rounded-2xl border border-gray-200 dark:border-[#344563] shadow-lg animate-fade-in">
            <div className="mb-8">
                <div className="font-display text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6">
                    INAP<span className="text-primary">·</span>Coach
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Welcome Back
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Sign in to your INAP Coach account
                </p>
            </div>

            {error && (
                <Alert variant="danger" className="mb-6">
                    {error}
                </Alert>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <InputField
                    name="email"
                    type="text"
                    label="Email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={handleChange}
                    error={validationErrors.email}
                />

                <InputField
                    name="password"
                    type="password"
                    label="Password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={handleChange}
                    error={validationErrors.password}
                />

                <FieldGroup className="mx-auto w-full">
                    <Field orientation="horizontal">
                        <Checkbox id="remember-me" name="remember-me" className='border-primary-mid' />
                        <FieldLabel htmlFor="remember-me">
                            Remember me
                        </FieldLabel>
                    </Field>
                </FieldGroup>

                <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    isLoading={isLoading}
                    isSuccess={succeeded}
                >
                    {succeeded ? 'Signed in!' : isLoading ? 'Signing in...' : 'Sign In'}
                </Button>
            </form>

            <div className="mt-6 space-y-3">
                <Link
                    href="/auth/forgot-password"
                    className="block text-center text-sm text-primary hover:text-primary-dark font-medium"
                >
                    Forgot password?
                </Link>

                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                    Don't have an account?{' '}
                    <Link
                        href="/signup"
                        className="text-primary hover:text-primary-dark font-medium"
                    >
                        Sign Up
                    </Link>
                </p>
            </div>
        </div>
    )
}
