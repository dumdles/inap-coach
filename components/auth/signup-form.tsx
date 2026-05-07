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
    { value: 'Alpha', label: 'Alpha Wing' },
    { value: 'Charlie', label: 'Charlie Wing' },
    { value: 'Delta', label: 'Delta Wing' },
    { value: 'Echo', label: 'Echo Wing' },
    { value: 'Sierra', label: 'Sierra Wing' },
    { value: 'Tango', label: 'Tango Wing' },
    { value: 'MIDS', label: 'MIDS Wing' },
    { value: 'Air', label: 'Air Wing' },
    { value: 'DIS', label: 'DIS Wing' },
]

const GENDERS = [
    { value: 'Male',   label: 'Male' },
    { value: 'Female', label: 'Female' },
]

const ACTIVITY_LEVELS = [
    { value: 'sedentary',   label: 'Sedentary',   description: 'Desk-bound most of the day, little to no exercise' },
    { value: 'light',       label: 'Light',        description: 'Light exercise or sport 1–3 days a week' },
    { value: 'moderate',    label: 'Moderate',     description: 'Moderate exercise or sport 3–5 days a week' },
    { value: 'active',      label: 'Active',       description: 'Hard exercise or sport 6–7 days a week' },
    { value: 'very_active', label: 'Very Active',  description: 'Hard daily training plus a physical job or twice-a-day sessions' },
]

const GOAL_MODES = [
    { value: 'bulk',     label: 'Bulk',     description: 'Build muscle mass' },
    { value: 'cut',      label: 'Cut',      description: 'Reduce body fat' },
    { value: 'maintain', label: 'Maintain', description: 'Hold composition' },
    { value: 'ippt',     label: 'IPPT',     description: 'Peak for test' },
]

function StepIndicator({ currentStep }: { currentStep: 1 | 2 | 3 }) {
    const steps = [
        { n: 1, label: 'Account' },
        { n: 2, label: 'Profile' },
        { n: 3, label: 'Goals' },
    ]
    return (
        <div className="flex items-center gap-2 mb-8">
            {steps.map(({ n, label }, i) => (
                <React.Fragment key={n}>
                    {i > 0 && <div className="flex-1 h-px bg-gray-200 dark:bg-[#344563]" />}
                    <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors duration-300',
                        currentStep === n ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-[#344563] text-gray-400'
                    )}>
                        {n}
                    </div>
                    <span className={cn(
                        'text-sm font-medium transition-colors duration-300',
                        currentStep === n ? 'text-primary' : 'text-gray-400 dark:text-gray-500'
                    )}>
                        {label}
                    </span>
                </React.Fragment>
            ))}
        </div>
    )
}

export const SignUpForm: React.FC = () => {
    const router = useRouter()
    const { signUp, error, isLoading, clearError } = useAuth()

    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [direction, setDirection] = useState<'forward' | 'back'>('forward')
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
    const [succeeded, setSucceeded] = useState(false)

    const [step1, setStep1] = useState({
        fullName: '',
        username: '',
        rank: '',
        wing: '',
        platoon: '',
        section: '',
        email: '',
        password: '',
    })

    const [step2, setStep2] = useState({
        dateOfBirth: '',
        gender: '',
        heightCm: '',
        weightKg: '',
    })

    const [step3, setStep3] = useState({
        activityLevel: 'moderate',
        goalMode: 'bulk',
    })

    const validateStep1 = (): boolean => {
        const errors: Record<string, string> = {}
        if (!step1.fullName) errors.fullName = 'Full name is required'
        if (!step1.username) {
            errors.username = 'Username is required'
        } else if (!/^[a-z0-9_]{3,20}$/.test(step1.username)) {
            errors.username = 'Username must be 3–20 characters: lowercase letters, numbers, underscores only'
        }
        if (!step1.rank) errors.rank = 'Rank is required'
        if (!step1.wing) errors.wing = 'Wing is required'
        if (!step1.platoon) errors.platoon = 'Platoon is required'
        if (!step1.section) errors.section = 'Section is required'
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
        if (!step2.dateOfBirth) errors.dateOfBirth = 'Date of birth is required'
        if (!step2.gender) errors.gender = 'Gender is required'
        if (!step2.heightCm || parseFloat(step2.heightCm) <= 0) errors.heightCm = 'Valid height is required'
        if (!step2.weightKg || parseFloat(step2.weightKg) <= 0) errors.weightKg = 'Valid weight is required'
        setValidationErrors(errors)
        return Object.keys(errors).length === 0
    }

    const handleContinue = () => {
        if (step === 1 && validateStep1()) {
            setValidationErrors({})
            setDirection('forward')
            setStep(2)
        } else if (step === 2 && validateStep2()) {
            setValidationErrors({})
            setDirection('forward')
            setStep(3)
        }
    }

    const handleBack = () => {
        setValidationErrors({})
        setDirection('back')
        setStep(prev => (prev > 1 ? (prev - 1) as 1 | 2 | 3 : prev))
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        clearError()
        try {
            await signUp(step1.email, step1.password, {
                full_name: step1.fullName,
                username: step1.username,
                rank: step1.rank,
                wing: step1.wing,
                platoon: step1.platoon,
                section: step1.section,
                date_of_birth: step2.dateOfBirth,
                gender: step2.gender,
                height_cm: parseFloat(step2.heightCm),
                weight_kg: parseFloat(step2.weightKg),
                activity_level: step3.activityLevel,
                goal_mode: step3.goalMode,
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
                ) : step === 2 ? (
                    <>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Your profile</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">We use this to personalise your experience.</p>
                    </>
                ) : (
                    <>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Your goals</h1>
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

                        <InputField
                            name="username"
                            type="text"
                            label="Username"
                            placeholder="johntxy"
                            value={step1.username}
                            onChange={handleStep1Change}
                            error={validationErrors.username}
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

                        <div className="grid grid-cols-2 gap-4">
                            <InputField
                                name="platoon"
                                type="text"
                                label="Platoon"
                                placeholder="e.g. 1"
                                value={step1.platoon}
                                onChange={handleStep1Change}
                                error={validationErrors.platoon}
                            />
                            <InputField
                                name="section"
                                type="text"
                                label="Section"
                                placeholder="e.g. A"
                                value={step1.section}
                                onChange={handleStep1Change}
                                error={validationErrors.section}
                            />
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
                ) : step === 2 ? (
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <InputField
                                name="dateOfBirth"
                                type="date"
                                label="Date of Birth"
                                value={step2.dateOfBirth}
                                onChange={handleStep2Change}
                                error={validationErrors.dateOfBirth}
                            />
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Gender <span className="text-danger">*</span>
                                </label>
                                <div className="flex gap-2">
                                    {GENDERS.map(({ value, label }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => {
                                                setStep2(prev => ({ ...prev, gender: value }))
                                                if (validationErrors.gender) setValidationErrors(prev => ({ ...prev, gender: '' }))
                                            }}
                                            className={cn(
                                                'flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all duration-150',
                                                step2.gender === value
                                                    ? 'border-primary bg-primary-light dark:bg-primary/20 text-primary'
                                                    : 'border-gray-200 dark:border-[#344563] text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-[#505F79]'
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                {validationErrors.gender && (
                                    <p className="text-xs text-danger">{validationErrors.gender}</p>
                                )}
                            </div>
                        </div>

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

                        <div className="flex gap-3">
                            <Button type="button" variant="outline" size="lg" onClick={handleBack}>
                                Back
                            </Button>
                            <Button type="button" size="lg" className="flex-1" onClick={handleContinue}>
                                Continue
                            </Button>
                        </div>

                        {footer}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} noValidate className="space-y-6">
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">Activity level</label>
                            <div className="grid grid-cols-1 gap-2">
                                {ACTIVITY_LEVELS.map(({ value, label, description }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setStep3(prev => ({ ...prev, activityLevel: value }))}
                                        className={cn(
                                            'text-left px-4 py-3 rounded-xl border-2 transition-all duration-150 flex items-center justify-between',
                                            step3.activityLevel === value
                                                ? 'border-primary bg-primary-light dark:bg-primary/20'
                                                : 'border-gray-200 dark:border-[#344563] hover:border-gray-300 dark:hover:border-[#505F79]'
                                        )}
                                    >
                                        <span className={cn(
                                            'font-semibold text-sm transition-colors duration-150',
                                            step3.activityLevel === value ? 'text-primary' : 'text-gray-900 dark:text-gray-100'
                                        )}>
                                            {label}
                                        </span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500">{description}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">Goal mode</label>
                            <div className="grid grid-cols-2 gap-3">
                                {GOAL_MODES.map(({ value, label, description }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setStep3(prev => ({ ...prev, goalMode: value }))}
                                        className={cn(
                                            'text-left p-4 rounded-xl border-2 transition-all duration-150',
                                            step3.goalMode === value
                                                ? 'border-primary bg-primary-light dark:bg-primary/20'
                                                : 'border-gray-200 dark:border-[#344563] hover:border-gray-300 dark:hover:border-[#505F79]'
                                        )}
                                    >
                                        <div className={cn(
                                            'font-semibold text-sm mb-0.5 transition-colors duration-150',
                                            step3.goalMode === value ? 'text-primary' : 'text-gray-900 dark:text-gray-100'
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
