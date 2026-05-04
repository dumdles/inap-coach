'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/context/auth-context'
import { Button } from '@/components/ui/button'
import { InputField } from '@/components/ui/input-field'
import { Alert } from '@/components/ui/alert'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const RANKS = ['OCT', 'ME4T', '2LT', 'LTA', 'CPT', 'MAJ', 'LTC', 'SLTC', 'COL']

const WINGS = [
    { value: 'alpha', label: 'Alpha Wing' },
    { value: 'charlie', label: 'Charlie Wing' },
    { value: 'delta', label: 'Delta Wing' },
    { value: 'echo', label: 'Echo Wing' },
    { value: 'sierra', label: 'Sierra Wing' },
    { value: 'tango', label: 'Tango Wing' },
    { value: 'mids', label: 'MIDS Wing' },
    { value: 'air', label: 'Air Wing' },
    { value: 'dis', label: 'DIS Wing' },
]

const GOAL_MODES = [
    { value: 'bulk',     label: 'Bulk',     description: 'Build muscle mass' },
    { value: 'cut',      label: 'Cut',      description: 'Reduce body fat' },
    { value: 'maintain', label: 'Maintain', description: 'Hold composition' },
    { value: 'ippt',     label: 'IPPT',     description: 'Peak for test' },
]

function StepIndicator({ currentStep }: { currentStep: 1 | 2 }) {
    return (
        <div className="flex items-center gap-2 mb-8">
            <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors duration-300',
                currentStep === 1 ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-[#344563] text-gray-400'
            )}>
                1
            </div>
            <span className={cn(
                'text-sm font-medium transition-colors duration-300',
                currentStep === 1 ? 'text-primary' : 'text-gray-400 dark:text-gray-500'
            )}>
                Account
            </span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-[#344563]" />
            <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors duration-300',
                currentStep === 2 ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-[#344563] text-gray-400'
            )}>
                2
            </div>
            <span className={cn(
                'text-sm font-medium transition-colors duration-300',
                currentStep === 2 ? 'text-primary' : 'text-gray-400 dark:text-gray-500'
            )}>
                Profile & Goal
            </span>
        </div>
    )
}

export const SignUpForm: React.FC = () => {
    const router = useRouter()
    const { signUp, error, isLoading, clearError } = useAuth()

    const [step, setStep] = useState<1 | 2>(1)
    const [direction, setDirection] = useState<'forward' | 'back'>('forward')
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
    const [succeeded, setSucceeded] = useState(false)

    const [step1, setStep1] = useState({
        fullName: '',
        rank: '',
        wing: '',
        email: '',
        password: '',
    })

    const [step2, setStep2] = useState({
        heightCm: '',
        weightKg: '',
        goalMode: 'bulk',
    })

    const validateStep1 = (): boolean => {
        const errors: Record<string, string> = {}
        if (!step1.fullName) errors.fullName = 'Full name is required'
        if (!step1.rank) errors.rank = 'Rank is required'
        if (!step1.wing) errors.wing = 'Wing is required'
        if (!step1.email) {
            errors.email = 'Email is required'
        } else if (!step1.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            errors.email = 'Invalid email address'
        }
        if (!step1.password) {
            errors.password = 'Password is required'
        } else if (step1.password.length < 8) {
            errors.password = 'Password must be at least 8 characters'
        }
        setValidationErrors(errors)
        return Object.keys(errors).length === 0
    }

    const validateStep2 = (): boolean => {
        const errors: Record<string, string> = {}
        if (!step2.heightCm || parseFloat(step2.heightCm) <= 0) errors.heightCm = 'Valid height is required'
        if (!step2.weightKg || parseFloat(step2.weightKg) <= 0) errors.weightKg = 'Valid weight is required'
        setValidationErrors(errors)
        return Object.keys(errors).length === 0
    }

    const handleContinue = () => {
        if (validateStep1()) {
            setValidationErrors({})
            setDirection('forward')
            setStep(2)
        }
    }

    const handleBack = () => {
        setValidationErrors({})
        setDirection('back')
        setStep(1)
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!validateStep2()) return
        clearError()
        try {
            await signUp(step1.email, step1.password, {
                full_name: step1.fullName,
                rank: step1.rank,
                wing: step1.wing,
                height_cm: parseFloat(step2.heightCm),
                weight_kg: parseFloat(step2.weightKg),
                goal_mode: step2.goalMode,
            })
            setSucceeded(true)
            await new Promise(r => setTimeout(r, 700))
            router.push('/dashboard')
        } catch (err) {
            console.error('Sign up error:', err)
        }
    }

    const handleStep1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setStep1(prev => ({ ...prev, [name]: value }))
        if (validationErrors[name]) setValidationErrors(prev => ({ ...prev, [name]: '' }))
    }

    const handleStep2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setStep2(prev => ({ ...prev, [name]: value }))
        if (validationErrors[name]) setValidationErrors(prev => ({ ...prev, [name]: '' }))
    }

    const footer = (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:text-primary-dark font-medium">
                Sign in
            </Link>
        </p>
    )

    return (
        // Stable card — never remounts, so no jarring layout shift
        <div className="w-full max-w-md mx-auto p-8 bg-white dark:bg-[#172B4D] rounded-2xl border border-gray-200 dark:border-[#344563] shadow-lg animate-fade-in overflow-hidden">
            {/* key={step} forces remount → animation replays on each transition */}
            <div
                key={step}
                className={direction === 'forward' ? 'animate-step-forward' : 'animate-step-back'}
            >
                <div className="font-display text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6">
                    INAP<span className="text-primary">·</span>Coach
                </div>

                {step === 1 ? (
                    <>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Create your account</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Set up your INAP Coach account.</p>
                    </>
                ) : (
                    <>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Your profile</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">We use this to calculate your daily targets.</p>
                    </>
                )}

                <StepIndicator currentStep={step} />

                {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

                {step === 1 ? (
                    <div className="space-y-4">
                        <InputField
                            name="fullName"
                            type="text"
                            label="Full Name"
                            placeholder="John Tan Xiang Yi"
                            value={step1.fullName}
                            onChange={handleStep1Change}
                            error={validationErrors.fullName}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Rank <span className="text-danger">*</span>
                                </label>
                                <Select
                                    value={step1.rank}
                                    onValueChange={(v) => {
                                        setStep1(prev => ({ ...prev, rank: v }))
                                        if (validationErrors.rank) setValidationErrors(prev => ({ ...prev, rank: '' }))
                                    }}
                                >
                                    <SelectTrigger className="w-full h-10 rounded-md border border-gray-300 dark:border-[#344563] bg-white dark:bg-[#0D1F3C] px-3 text-sm text-gray-800 dark:text-gray-100">
                                        <SelectValue placeholder="Select rank" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {RANKS.map(r => (
                                            <SelectItem key={r} value={r}>{r}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {validationErrors.rank && (
                                    <p className="text-xs text-danger">{validationErrors.rank}</p>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Wing <span className="text-danger">*</span>
                                </label>
                                <Select
                                    value={step1.wing}
                                    onValueChange={(v) => {
                                        setStep1(prev => ({ ...prev, wing: v }))
                                        if (validationErrors.wing) setValidationErrors(prev => ({ ...prev, wing: '' }))
                                    }}
                                >
                                    <SelectTrigger className="w-full h-10 rounded-md border border-gray-300 dark:border-[#344563] bg-white dark:bg-[#0D1F3C] px-3 text-sm text-gray-800 dark:text-gray-100">
                                        <SelectValue placeholder="Select wing" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {WINGS.map(({ value, label }) => (
                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {validationErrors.wing && (
                                    <p className="text-xs text-danger">{validationErrors.wing}</p>
                                )}
                            </div>
                        </div>

                        <InputField
                            name="email"
                            type="text"
                            label="Email"
                            placeholder="you@example.com"
                            value={step1.email}
                            onChange={handleStep1Change}
                            error={validationErrors.email}
                        />

                        <InputField
                            name="password"
                            type="password"
                            label="Password"
                            placeholder="At least 8 characters"
                            value={step1.password}
                            onChange={handleStep1Change}
                            error={validationErrors.password}
                        />

                        <Button type="button" size="lg" className="w-full" onClick={handleContinue}>
                            Continue
                        </Button>

                        {footer}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} noValidate className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <InputField
                                name="heightCm"
                                type="number"
                                label="Height (cm)"
                                placeholder="175"
                                value={step2.heightCm}
                                onChange={handleStep2Change}
                                error={validationErrors.heightCm}
                            />
                            <InputField
                                name="weightKg"
                                type="number"
                                label="Weight (kg)"
                                placeholder="72.5"
                                value={step2.weightKg}
                                onChange={handleStep2Change}
                                error={validationErrors.weightKg}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">Goal mode</label>
                            <div className="grid grid-cols-2 gap-3">
                                {GOAL_MODES.map(({ value, label, description }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setStep2(prev => ({ ...prev, goalMode: value }))}
                                        className={cn(
                                            'text-left p-4 rounded-xl border-2 transition-all duration-150',
                                            step2.goalMode === value
                                                ? 'border-primary bg-primary-light dark:bg-primary/20'
                                                : 'border-gray-200 dark:border-[#344563] hover:border-gray-300 dark:hover:border-[#505F79]'
                                        )}
                                    >
                                        <div className={cn(
                                            'font-semibold text-sm mb-0.5 transition-colors duration-150',
                                            step2.goalMode === value ? 'text-primary' : 'text-gray-900 dark:text-gray-100'
                                        )}>
                                            {label}
                                        </div>
                                        <div className="text-xs text-gray-400 dark:text-gray-500">{description}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button type="button" variant="outline" size="lg" onClick={handleBack}>
                                Back
                            </Button>
                            <Button
                                type="submit"
                                size="lg"
                                className="flex-1"
                                isLoading={isLoading}
                                isSuccess={succeeded}
                            >
                                {succeeded ? 'Account created!' : isLoading ? 'Creating account...' : 'Create account'}
                            </Button>
                        </div>

                        {footer}
                    </form>
                )}
            </div>
        </div>
    )
}
