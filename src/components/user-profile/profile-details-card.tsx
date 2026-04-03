import type { Control, FieldValues } from "react-hook-form";

import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ProfileContactFields } from "@/components/profile/profile-contact-fields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ProfileGetData } from "@/types/auth-api";

import type { ProfileEditorForm } from "./user-profile-form-schema";

export function ProfileDetailsCard({
  control,
  profileBundle,
  userEmail,
  disabled,
  onAvatarUploaded,
}: {
  control: Control<ProfileEditorForm>;
  profileBundle: ProfileGetData | null;
  userEmail: string;
  disabled?: boolean;
  onAvatarUploaded: (url: string) => Promise<void>;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="border-border/80 bg-card/90 lg:col-span-4 transition-all duration-150 hover:-translate-y-1 hover:shadow-card-hover">
        <CardHeader>
          <CardTitle className="text-base">Photo</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center pb-6">
          <AvatarUploader
            currentUrl={profileBundle?.profile?.avatar_url}
            displayName={profileBundle?.profile?.display_name}
            disabled={disabled ?? !profileBundle}
            onUploaded={onAvatarUploaded}
          />
        </CardContent>
      </Card>
      <Card className="border-border/80 bg-card/90 lg:col-span-8 transition-all duration-150 hover:-translate-y-1 hover:shadow-card-hover">
        <CardHeader>
          <CardTitle className="text-base">Profile details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name</FormLabel>
                  <FormControl>
                    <Input className="bg-surface-inner" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="avatarUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Avatar URL (optional override)</FormLabel>
                  <FormControl>
                    <Input className="bg-surface-inner" placeholder="https://…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="jobTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title / role</FormLabel>
                  <FormControl>
                    <Input className="bg-surface-inner" placeholder="e.g. Operations lead" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <FormControl>
                    <Input className="bg-surface-inner" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <ProfileContactFields control={control as unknown as Control<FieldValues>} />
          <div>
            <p className="text-xs text-muted-foreground">Contact email</p>
            <Input className="mt-1 bg-surface-inner" readOnly value={userEmail} aria-readonly="true" />
          </div>
          <FormField
            control={control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio / notes</FormLabel>
                <FormControl>
                  <Textarea
                    className="min-h-[100px] bg-surface-inner"
                    placeholder="Optional context visible to your team where policy allows."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
