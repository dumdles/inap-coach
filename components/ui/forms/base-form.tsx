'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { InputField } from '@/components/ui/input-field'
import { Button } from '@/components/ui/button'

interface BaseFormProps {
    onSubmit: (data: any) => Promise<void>
    fields: Array<{
        name: string
        label: string
        type: string
        placeholder?: string
        required?: boolean
        hint?: string
    }>
    submitText?: string
    isLoading?: boolean
}

export const BaseForm: React.FC<BaseFormProps> = ({
    onSubmit,
    fields,
    submitText = 'Submit',
    isLoading = false,
}) => {
    const {
        register,
        handleSubmit,
        formState: { errors },
        setError,
    } = useForm({
        mode: 'onBlur',
    })

    const handleFormSubmit = async (data: any) => {
        try {
            await onSubmit(data)
        } catch (error: any) {
            // Handle error
            if (error.message) {
                setError('root', { message: error.message })
            }
        }
    }

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            {fields.map((field) => (
                <InputField
                    key={field.name}
                    {...register(field.name, {
                        required: field.required ? `${field.label} is required` : false,
                    })}
                    label={field.label}
                    type={field.type}
                    placeholder={field.placeholder}
                    hint={field.hint}
                    required={field.required}
                    error={errors[field.name]?.message?.toString()}
                />
            ))}

            <Button
                type="submit"
                disabled={isLoading}
                className="w-full"
            >
                {isLoading ? 'Loading...' : submitText}
            </Button>
        </form>
    )
}