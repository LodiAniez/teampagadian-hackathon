import { forwardRef, useState } from "react";
import {
  Modal,
  FlatList,
  View,
  Text,
  Pressable,
  TextInput,
  type TextInputProps,
} from "react-native";
import { TextField } from "./TextField";
import { CountryCodeButton, COUNTRIES, type Country } from "./CountryCodeButton";
import { cn } from "@/lib/cn";

export type PhoneFieldProps = Omit<TextInputProps, "keyboardType"> & {
  label?: string;
  error?: string;
  hint?: string;
  defaultCountry?: string;
  onCountryChange?: (country: Country) => void;
  /** Called with the full E.164-style number (dialCode + local) on every change. */
  onPhoneChange?: (fullNumber: string) => void;
  containerClassName?: string;
};

/**
 * Phone number input wired for react-hook-form + zod.
 *
 * The `value` / `onChangeText` pair carries only the local part (no dial code).
 * Connect it to a form field that stores the local number; let the dial code
 * live in a separate field or derive the full number via `onPhoneChange`.
 *
 * Usage with Controller:
 *   <Controller
 *     control={control}
 *     name="localNumber"
 *     render={({ field }) => (
 *       <PhoneField
 *         value={field.value}
 *         onChangeText={field.onChange}
 *         onBlur={field.onBlur}
 *         onCountryChange={(c) => setValue("dialCode", c.dialCode)}
 *         error={errors.localNumber?.message}
 *       />
 *     )}
 *   />
 */
export const PhoneField = forwardRef<TextInput, PhoneFieldProps>(
  (
    {
      label = "Phone number",
      error,
      hint,
      defaultCountry = "PH",
      onCountryChange,
      onPhoneChange,
      containerClassName,
      value,
      onChangeText,
      onBlur,
      ...rest
    },
    ref,
  ) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [selected, setSelected] = useState<Country>(
      () => COUNTRIES.find((c) => c.code === defaultCountry) ?? COUNTRIES[0],
    );

    function handleCountrySelect(country: Country) {
      setSelected(country);
      setModalVisible(false);
      onCountryChange?.(country);
      if (value) onPhoneChange?.(`${country.dialCode}${value}`);
    }

    function handleNumberChange(raw: string) {
      onChangeText?.(raw);
      onPhoneChange?.(`${selected.dialCode}${raw}`);
    }

    return (
      <>
        <TextField
          ref={ref}
          label={label}
          error={error}
          hint={hint}
          keyboardType="phone-pad"
          containerClassName={containerClassName}
          value={value}
          onChangeText={handleNumberChange}
          onBlur={onBlur}
          placeholder="9XX XXX XXXX"
          leftElement={
            <CountryCodeButton country={selected} onPress={() => setModalVisible(true)} />
          }
          {...rest}
        />

        <Modal
          visible={modalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setModalVisible(false)}
        >
          <View className="flex-1 bg-white">
            <View className="flex-row items-center justify-between border-b border-gray-100 px-4 py-4">
              <Text className="text-lg font-semibold text-gray-900">Select country</Text>
              <Pressable onPress={() => setModalVisible(false)} className="px-2 py-1">
                <Text className="font-medium text-brand-600">Done</Text>
              </Pressable>
            </View>

            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <Pressable
                  className={cn(
                    "flex-row items-center gap-3 px-4 py-3 active:bg-gray-50",
                    selected.code === item.code && "bg-brand-50",
                  )}
                  onPress={() => handleCountrySelect(item)}
                >
                  <Text className="text-2xl">{item.flag}</Text>
                  <View className="flex-1">
                    <Text className="text-base font-medium text-gray-900">{item.name}</Text>
                  </View>
                  <Text className="text-sm text-gray-500">{item.dialCode}</Text>
                </Pressable>
              )}
            />
          </View>
        </Modal>
      </>
    );
  },
);
PhoneField.displayName = "PhoneField";
