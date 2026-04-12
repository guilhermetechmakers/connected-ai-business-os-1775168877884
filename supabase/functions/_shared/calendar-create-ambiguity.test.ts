import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { isCalendarCreateDateAmbiguousFromUserMessage } from "./calendar-create-ambiguity.ts";

Deno.test("isCalendarCreateDateAmbiguousFromUserMessage: time only without day", () => {
  assertEquals(
    isCalendarCreateDateAmbiguousFromUserMessage(
      'Add a new event at 6pm called JiuJitsu and invite guilherme.meira2906@gmail.com',
    ),
    true,
  );
});

Deno.test("isCalendarCreateDateAmbiguousFromUserMessage: not ambiguous when day is given", () => {
  assertEquals(
    isCalendarCreateDateAmbiguousFromUserMessage(
      "Add JiuJitsu tomorrow at 6pm and invite a@b.com",
    ),
    false,
  );
  assertEquals(
    isCalendarCreateDateAmbiguousFromUserMessage(
      "Schedule meeting next Monday at 6pm",
    ),
    false,
  );
});

Deno.test("isCalendarCreateDateAmbiguousFromUserMessage: not create intent", () => {
  assertEquals(
    isCalendarCreateDateAmbiguousFromUserMessage("What is on my calendar at 6pm?"),
    false,
  );
});
